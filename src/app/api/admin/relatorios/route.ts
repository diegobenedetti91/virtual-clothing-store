import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { extractMpPaymentDetails, PAYMENT_TYPE_LABEL } from "@/lib/mercadoPagoPayment";
import { averageTicket, freeShippingCoupons } from "@/lib/ticket";

const PAID = ["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "DELIVERED", "RETIRADO"];
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rótulo da forma de pagamento para o relatório. */
function methodLabel(o: { paymentGateway: string | null; paymentMethod: string | null; paymentType: string | null; paymentInstallments: number | null }) {
  if (o.paymentGateway === "mercadopago") {
    if (!o.paymentType) return "Mercado Pago";
    const base = PAYMENT_TYPE_LABEL[o.paymentType] || o.paymentType;
    return o.paymentType === "credit_card" && o.paymentInstallments && o.paymentInstallments > 1 ? `${base} (${o.paymentInstallments}x)` : base;
  }
  if (o.paymentGateway === "nupay" || o.paymentMethod === "NuPay") return "NuPay";
  if (o.paymentMethod === "Infinity Pay") return "Infinity Pay";
  return o.paymentMethod || "WhatsApp / a combinar";
}
/** Agrupa crédito parcelado junto com crédito à vista no resumo por forma. */
function groupLabel(o: Parameters<typeof methodLabel>[0]) {
  return methodLabel(o).replace(/ \(\d+x\)$/, "");
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const sp = req.nextUrl.searchParams;
    const dateFrom = sp.get("dateFrom");
    const dateTo = sp.get("dateTo");
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.gte = new Date(`${dateFrom}T00:00:00-03:00`);
    if (dateTo) createdAt.lte = new Date(`${dateTo}T23:59:59.999-03:00`);

    const orders = await prisma.order.findMany({
      where: { status: { in: PAID }, ...(Object.keys(createdAt).length ? { createdAt } : {}) },
      select: {
        id: true, orderNumber: true, customerName: true, total: true, shippingCost: true, shippingLabelCost: true, couponCode: true, status: true, createdAt: true,
        paymentFee: true, paymentNetAmount: true, paymentType: true, paymentInstallments: true, paymentMethod: true, paymentGateway: true, paymentId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Estornos aprovados, numa consulta só
    const refunds = orders.length
      ? await prisma.return.groupBy({
          by: ["orderId"],
          where: { orderId: { in: orders.map((o) => o.id) }, status: "APPROVED" },
          _sum: { refundAmount: true },
        })
      : [];
    const refundMap = new Map(refunds.map((r) => [r.orderId, r._sum.refundAmount || 0]));

    const rows = orders.map((o) => {
      const refunded = refundMap.get(o.id) || 0;
      // Taxa conferida = o gateway informou o líquido (hoje só o Mercado Pago informa)
      const feeKnown = o.paymentGateway === "mercadopago" && o.paymentNetAmount != null;
      const fee = feeKnown ? o.paymentFee : null;
      // Frete vai para a transportadora: custo real da etiqueta ou, sem ele, o frete cobrado
      const shipping = round2(o.shippingLabelCost ?? o.shippingCost ?? 0);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        createdAt: o.createdAt,
        status: o.status,
        method: methodLabel(o),
        group: groupLabel(o),
        gateway: o.paymentGateway,
        total: o.total,
        fee,
        feeRate: fee != null && o.total > 0 ? (fee / o.total) * 100 : null,
        refunded,
        shipping,
        shippingEstimated: o.shippingLabelCost == null && shipping > 0,
        net: round2(o.total - refunded - (fee ?? 0) - shipping),
        missingFee: o.paymentGateway === "mercadopago" && !!o.paymentId && o.paymentNetAmount == null,
      };
    });

    const gross = rows.reduce((s, r) => s + r.total, 0);
    const fees = rows.reduce((s, r) => s + (r.fee ?? 0), 0);
    const refundsTotal = rows.reduce((s, r) => s + r.refunded, 0);
    const shippingTotal = rows.reduce((s, r) => s + r.shipping, 0);
    const knownGross = rows.filter((r) => r.fee != null).reduce((s, r) => s + r.total, 0);

    const groups = new Map<string, { label: string; count: number; gross: number; fees: number; knownGross: number; feeKnownCount: number }>();
    for (const r of rows) {
      const g = groups.get(r.group) || { label: r.group, count: 0, gross: 0, fees: 0, knownGross: 0, feeKnownCount: 0 };
      g.count++;
      g.gross += r.total;
      if (r.fee != null) { g.fees += r.fee; g.knownGross += r.total; g.feeKnownCount++; }
      groups.set(r.group, g);
    }

    return NextResponse.json({
      rows,
      summary: {
        orders: rows.length,
        gross: round2(gross),
        fees: round2(fees),
        refunds: round2(refundsTotal),
        shipping: round2(shippingTotal),
        net: round2(gross - refundsTotal - fees - shippingTotal),
        ticket: averageTicket(orders, await freeShippingCoupons(orders)),
        avgFeeRate: knownGross > 0 ? (fees / knownGross) * 100 : null,
        missingFees: rows.filter((r) => r.missingFee).length,
        unknownFeeOrders: rows.filter((r) => r.fee == null).length,
      },
      byMethod: [...groups.values()]
        .map((g) => ({ ...g, feeRate: g.knownGross > 0 ? (g.fees / g.knownGross) * 100 : null }))
        .sort((a, b) => b.gross - a.gross),
    });
  } catch (error) {
    console.error("[RELATORIOS] Error:", error);
    return NextResponse.json({ error: "Erro ao carregar relatório" }, { status: 500 });
  }
}

/** Busca no Mercado Pago a taxa real dos pedidos que ainda não têm (pedidos antigos). */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { mercadoPagoAccessToken: true } });
  const token = settings?.mercadoPagoAccessToken;
  if (!token) return NextResponse.json({ error: "Mercado Pago não configurado" }, { status: 400 });

  const pending = await prisma.order.findMany({
    where: { paymentGateway: "mercadopago", paymentId: { not: null }, paymentNetAmount: null, status: { in: PAID } },
    select: { id: true, paymentId: true },
    orderBy: { createdAt: "desc" },
    take: 40, // lote por clique, para não estourar o tempo da requisição
  });

  let updated = 0;
  let failed = 0;
  for (const o of pending) {
    try {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${o.paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) { failed++; continue; }
      const d = extractMpPaymentDetails(await res.json());
      await prisma.order.update({
        where: { id: o.id },
        data: { paymentFee: d.fee, paymentNetAmount: d.net ?? undefined, paymentType: d.paymentType, paymentInstallments: d.installments },
      });
      if (d.net != null) updated++; else failed++;
    } catch {
      failed++;
    }
  }

  const remaining = await prisma.order.count({
    where: { paymentGateway: "mercadopago", paymentId: { not: null }, paymentNetAmount: null, status: { in: PAID } },
  });
  return NextResponse.json({ updated, failed, remaining });
}
