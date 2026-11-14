import { prisma } from "@/lib/prisma";
import { needsMelhorEnvioLabel } from "@/lib/utils";

export type StepState = "done" | "working" | "error" | "skip";

export interface NewOrderStep {
  key: "pagamento" | "bling" | "nota" | "etiqueta";
  label: string;
  state: StepState;
  detail?: string;
}

export interface NewOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  itemCount: number;
  createdAt: string;
  delivery: string;
  steps: NewOrderStep[];
  /** Tudo que é automático terminou: é só separar e despachar */
  ready: boolean;
  /** Alguma etapa automática falhou e precisa do dono da loja */
  hasError: boolean;
  canPrintLabel: boolean;
}

const PAID = ["CONFIRMED", "PRONTO_PARA_RETIRADA"];

/** Pedidos pagos que o dono da loja ainda não viu, com o andamento da automação (Bling, nota, etiqueta). */
export async function getNewOrders(): Promise<{ orders: NewOrder[]; total: number }> {
  const settings = await prisma.companySettings.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { blingAtivo: true, blingNfeAuto: true },
  });
  const where = { adminSeenAt: null, status: { in: PAID }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, orderNumber: true, customerName: true, total: true, createdAt: true, shippingMethod: true,
        blingPedidoId: true, blingIntegrationStatus: true,
        nfeStatus: true, nfeNumero: true, nfeError: true,
        melhorEnvioShipmentId: true, labelGeneratedAt: true, labelStepError: true, labelValid: true, shipmentStatus: true,
        shipmentRetryError: true, trackingCode: true,
        items: { select: { quantity: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const orders = rows.map((o): NewOrder => {
    const steps: NewOrderStep[] = [{ key: "pagamento", label: "Pagamento aprovado", state: "done" }];

    if (settings?.blingAtivo) {
      steps.push({
        key: "bling",
        label: "Pedido no Bling",
        state: o.blingPedidoId ? "done" : o.blingIntegrationStatus === "error" ? "error" : "working",
        detail: o.blingIntegrationStatus === "error" && !o.blingPedidoId ? "Falhou — reenvie pelo pedido" : undefined,
      });
      if (settings.blingNfeAuto) {
        const st = o.nfeStatus;
        steps.push({
          key: "nota",
          label: "Nota fiscal",
          state: st === "authorized" ? "done" : st === "rejected" || st === "denied" || st === "error" ? "error" : "working",
          detail:
            st === "authorized" ? (o.nfeNumero ? `NF-e nº ${o.nfeNumero} autorizada` : "Autorizada")
            : st === "rejected" ? `Rejeitada: ${o.nfeError?.slice(0, 120) || "veja o motivo no pedido"}`
            : st === "denied" ? "Denegada pela SEFAZ"
            : st === "error" ? (o.nfeError?.slice(0, 120) || "Erro ao emitir")
            : st === "processing" || st === "pending" ? "Aguardando a SEFAZ"
            : "Será emitida em instantes",
        });
      }
    }

    const usesLabel = needsMelhorEnvioLabel(o.shippingMethod);
    const labelGenerated = !!o.labelGeneratedAt || ["generated", "posted", "in_transit", "delivered"].includes(o.shipmentStatus || "");
    if (usesLabel) {
      const err = o.labelValid === false || !!o.labelStepError || (!o.melhorEnvioShipmentId && !!o.shipmentRetryError);
      const msg = o.labelStepError || o.shipmentRetryError;
      steps.push({
        key: "etiqueta",
        label: "Etiqueta de envio",
        state: labelGenerated && !err ? "done" : err ? "error" : "working",
        detail:
          labelGenerated && !err ? (o.trackingCode ? `Rastreio ${o.trackingCode}` : "Pronta para imprimir")
          : err ? (msg && /saldo|insuficiente|balance/i.test(msg) ? "Sem saldo no Melhor Envio" : msg?.slice(0, 120) || "Precisa ser recriada")
          : "Gerando no Melhor Envio",
      });
    }

    const delivery = o.shippingMethod === "retirada" ? "Retirada na loja" : o.shippingMethod === "local" ? "Entrega local" : usesLabel ? "Envio pelos Correios/transportadora" : "Entrega a combinar";
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      total: o.total,
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      createdAt: o.createdAt.toISOString(),
      delivery,
      steps,
      ready: steps.every((s) => s.state === "done" || s.state === "skip"),
      hasError: steps.some((s) => s.state === "error"),
      canPrintLabel: usesLabel && labelGenerated && o.labelValid !== false,
    };
  });

  return { orders, total };
}

/** Marca como vistos (some do aviso). Sem ids = todos. */
export async function markOrdersSeen(ids?: string[]) {
  await prisma.order.updateMany({
    where: { adminSeenAt: null, ...(ids?.length ? { id: { in: ids.slice(0, 200) } } : {}) },
    data: { adminSeenAt: new Date() },
  });
}
