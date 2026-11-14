/**
 * Lucro de verdade por pedido (DRE simplificado).
 *
 *   Receita bruta (produtos + frete cobrado)
 *   − descontos de cupom − desconto Pix
 *   − taxa do gateway − custo das peças
 *   − frete (vai para a transportadora: custo real da etiqueta; sem ele, o frete cobrado)
 *   − estornos de devoluções aprovadas
 *   = lucro líquido
 *
 * Função pura: recebe os pedidos já carregados, para ser usada no dashboard,
 * nos relatórios e em testes.
 */

export const PAID_STATUSES = ["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "DELIVERED", "RETIRADO"];

export interface ProfitOrderInput {
  id: string;
  orderNumber: string;
  customerName: string;
  createdAt: Date | string;
  subtotal: number;
  shippingCost: number;
  total: number;
  couponDiscount?: number | null;
  paymentFee?: number | null;
  shippingLabelCost?: number | null;
  items: { quantity: number; price: number; product: { costPrice: number | null } | null }[];
}

export interface ProfitRow {
  id: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  gross: number;
  coupon: number;
  pix: number;
  fees: number;
  cogs: number;
  shipping: number;
  refunds: number;
  net: number;
  margin: number | null;
  /** Peças sem preço de custo cadastrado (lucro superestimado) */
  itemsWithoutCost: number;
  feeKnown: boolean;
  labelCostKnown: boolean;
}

export interface ProfitTotals {
  orders: number;
  gross: number;
  coupon: number;
  pix: number;
  fees: number;
  cogs: number;
  shipping: number;
  refunds: number;
  net: number;
  margin: number | null;
  units: number;
  unitsWithoutCost: number;
  ordersWithFee: number;
  ordersWithLabelCost: number;
  lossOrders: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function profitOfOrder(o: ProfitOrderInput, refunded = 0): ProfitRow {
  const gross = r2((o.subtotal || 0) + (o.shippingCost || 0));
  const coupon = r2(o.couponDiscount || 0);
  // O que sobra entre bruto, total pago e cupom é o desconto Pix
  const pix = r2(Math.max(0, gross - (o.total || 0) - coupon));
  const fees = r2(o.paymentFee || 0);
  let cogs = 0;
  let itemsWithoutCost = 0;
  for (const it of o.items) {
    const cost = it.product?.costPrice;
    if (cost == null) itemsWithoutCost += it.quantity;
    else cogs += cost * it.quantity;
  }
  cogs = r2(cogs);
  const labelCostKnown = o.shippingLabelCost != null;
  // O frete cobrado do cliente não é da loja: paga a etiqueta. Desconta o custo real da etiqueta
  // (quando registrado) ou, sem ele, o próprio frete cobrado. Frete grátis por cupom já saiu em "cupom".
  const shipping = r2(labelCostKnown ? (o.shippingLabelCost as number) : o.shippingCost || 0);
  const refunds = r2(refunded);
  const net = r2(gross - coupon - pix - fees - cogs - shipping - refunds);
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    createdAt: new Date(o.createdAt).toISOString(),
    gross,
    coupon,
    pix,
    fees,
    cogs,
    shipping,
    refunds,
    net,
    margin: gross > 0 ? (net / gross) * 100 : null,
    itemsWithoutCost,
    feeKnown: fees > 0,
    labelCostKnown,
  };
}

export function sumProfit(rows: ProfitRow[], units = 0): ProfitTotals {
  const t: ProfitTotals = {
    orders: rows.length, gross: 0, coupon: 0, pix: 0, fees: 0, cogs: 0, shipping: 0, refunds: 0, net: 0,
    margin: null, units, unitsWithoutCost: 0, ordersWithFee: 0, ordersWithLabelCost: 0, lossOrders: 0,
  };
  for (const r of rows) {
    t.gross += r.gross;
    t.coupon += r.coupon;
    t.pix += r.pix;
    t.fees += r.fees;
    t.cogs += r.cogs;
    t.shipping += r.shipping;
    t.refunds += r.refunds;
    t.net += r.net;
    t.unitsWithoutCost += r.itemsWithoutCost;
    if (r.feeKnown) t.ordersWithFee++;
    if (r.labelCostKnown) t.ordersWithLabelCost++;
    if (r.net < 0) t.lossOrders++;
  }
  for (const k of ["gross", "coupon", "pix", "fees", "cogs", "shipping", "refunds", "net"] as const) t[k] = r2(t[k]);
  t.margin = t.gross > 0 ? (t.net / t.gross) * 100 : null;
  return t;
}

/** Calcula linhas e totais de uma lista de pedidos pagos. */
export function computeProfit(orders: ProfitOrderInput[], refundsByOrder: Map<string, number> = new Map()) {
  const rows = orders.map((o) => profitOfOrder(o, refundsByOrder.get(o.id) || 0));
  const units = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);
  return { rows, totals: sumProfit(rows, units) };
}

/** Campos do Prisma necessários para o cálculo (usar no select). */
export const PROFIT_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  customerName: true,
  createdAt: true,
  subtotal: true,
  shippingCost: true,
  total: true,
  couponDiscount: true,
  paymentFee: true,
  shippingLabelCost: true,
  items: { select: { quantity: true, price: true, product: { select: { costPrice: true } } } },
} as const;
