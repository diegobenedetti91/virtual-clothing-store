import { prisma } from "@/lib/prisma";
import { SHIPMENT_ERROR_WHERE } from "@/lib/shipmentUtils";

export interface AdminAlert {
  key: string;
  count: number;
  title: string;
  description: string;
  href: string;
  severity: "critical" | "warning" | "info";
}

export interface AdminBadges {
  pedidos: number;
  esteira: number;
  rastreamento: number;
  devolucoes: number;
  avaliacoes: number;
  produtos: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** Pendências que o dono da loja precisa resolver — alimenta o dashboard e os contadores do menu. */
export async function getAdminAlerts(): Promise<{ alerts: AdminAlert[]; badges: AdminBadges }> {
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { blingAtivo: true } });
  const nfeFailed = settings?.blingAtivo
    ? await prisma.order.count({ where: { nfeStatus: { in: ["rejected", "denied", "error"] }, status: { not: "CANCELLED" } } })
    : 0;
  // Cancelado com nota autorizada: a nota precisa ser cancelada no Bling (SEFAZ dá 24h)
  const nfeToCancel = settings?.blingAtivo
    ? await prisma.order.count({ where: { status: "CANCELLED", nfeStatus: "authorized" } })
    : 0;
  const twoDaysAgo = new Date(Date.now() - 2 * DAY);
  const sixtyDaysAgo = new Date(Date.now() - 60 * DAY);

  const [
    labelErrors,
    labelInvalid,
    blingPending,
    lateToShip,
    toShip,
    returnsPending,
    reviewsPending,
    outOfStock,
  ] = await Promise.all([
    prisma.order.count({ where: SHIPMENT_ERROR_WHERE }),
    prisma.order.count({ where: { labelValid: false, status: "CONFIRMED" } }),
    settings?.blingAtivo
      ? prisma.order.count({
          where: {
            blingPedidoId: null,
            status: { in: ["CONFIRMED", "SHIPPED", "DELIVERED", "PRONTO_PARA_RETIRADA", "RETIRADO"] },
            createdAt: { gte: sixtyDaysAgo },
          },
        })
      : Promise.resolve(0),
    prisma.order.count({ where: { status: "CONFIRMED", updatedAt: { lt: twoDaysAgo } } }),
    prisma.order.count({ where: { status: "CONFIRMED" } }),
    prisma.return.count({ where: { status: "PENDING" } }),
    prisma.productReview.count({ where: { approved: false } }),
    prisma.product.count({ where: { active: true, stock: { lte: 0 } } }),
  ]);

  const alerts: AdminAlert[] = [
    {
      key: "labelErrors",
      count: labelErrors,
      title: "Pedidos pagos sem etiqueta",
      description: "A geração automática da etiqueta falhou. Gere novamente.",
      href: "/admin/rastreamento",
      severity: "critical" as const,
    },
    {
      key: "blingPending",
      count: blingPending,
      title: "Pedidos não enviados ao Bling",
      description: "Pedidos pagos (últimos 60 dias) que não estão no Bling.",
      href: "/admin/pedidos",
      severity: "critical" as const,
    },
    {
      key: "nfeFailed",
      count: nfeFailed,
      title: "Notas fiscais rejeitadas",
      description: "A SEFAZ recusou a nota. Veja o motivo no pedido, corrija no Bling e reenvie.",
      href: "/admin/pedidos",
      severity: "critical" as const,
    },
    {
      key: "nfeToCancel",
      count: nfeToCancel,
      title: "Pedidos cancelados com nota emitida",
      description: "Cancele a NF-e no Bling (prazo de 24h após a autorização).",
      href: "/admin/pedidos",
      severity: "warning" as const,
    },
    {
      key: "labelInvalid",
      count: labelInvalid,
      title: "Etiquetas inválidas",
      description: "Etiquetas criadas que precisam ser recriadas.",
      href: "/admin/rastreamento",
      severity: "warning" as const,
    },
    {
      key: "lateToShip",
      count: lateToShip,
      title: "Pedidos parados há mais de 2 dias",
      description: "Confirmados e ainda não enviados.",
      href: "/admin/esteira",
      severity: "warning" as const,
    },
    {
      key: "returnsPending",
      count: returnsPending,
      title: "Devoluções aguardando análise",
      description: "Clientes esperando uma resposta.",
      href: "/admin/devolucoes",
      severity: "warning" as const,
    },
    {
      key: "reviewsPending",
      count: reviewsPending,
      title: "Avaliações para aprovar",
      description: "Aprovadas aparecem na página do produto.",
      href: "/admin/avaliacoes",
      severity: "info" as const,
    },
    {
      key: "outOfStock",
      count: outOfStock,
      title: "Produtos ativos sem estoque",
      description: "Aparecem como esgotados na loja.",
      href: "/admin/produtos",
      severity: "info" as const,
    },
  ].filter((a) => a.count > 0);

  return {
    alerts,
    badges: {
      pedidos: blingPending + nfeFailed,
      esteira: toShip,
      rastreamento: labelErrors + labelInvalid,
      devolucoes: returnsPending,
      avaliacoes: reviewsPending,
      produtos: outOfStock,
    },
  };
}
