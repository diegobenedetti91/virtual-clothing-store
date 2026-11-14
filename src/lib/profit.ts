/**
 * Lucro de verdade por pedido (DRE simplificado).
 *
 * DRE simplificado, com os nomes usados no mercado:
 *
 *   Vendas brutas (GMV)      produtos a preço cheio + frete cobrado
 *   − cupons − desconto Pix − crédito de cashback usado
 *   = Faturamento            o que o cliente pagou (valor da nota)
 *   − devoluções (estornos) − impostos sobre a venda (alíquota do Simples/DAS)
 *   = Receita líquida
 *   − custo das peças (CMV)
 *   = Lucro bruto
 *   − taxas de pagamento − frete (etiquetas: custo real; sem ele, o frete cobrado)
 *   = Lucro líquido
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
  /** Crédito da conta (cashback) usado como desconto */
  creditUsed?: number | null;
  paymentFee?: number | null;
  shippingLabelCost?: number | null;
  items: { quantity: number; price: number; product: { costPrice: number | null } | null }[];
}

export interface ProfitRow {
  id: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  /** Vendas brutas (GMV): produtos a preço cheio + frete cobrado */
  gross: number;
  coupon: number;
  pix: number;
  /** Crédito de cashback usado pelo cliente (desconto) */
  credit: number;
  /** Faturamento: o que o cliente pagou */
  revenue: number;
  refunds: number;
  /** Impostos sobre a venda (alíquota × (faturamento − devoluções)) */
  taxes: number;
  /** Receita líquida: faturamento − devoluções − impostos */
  netRevenue: number;
  /** Custo das peças (CMV) */
  cogs: number;
  /** Lucro bruto: receita líquida − CMV */
  grossProfit: number;
  fees: number;
  shipping: number;
  /** Lucro líquido */
  net: number;
  /** Margem líquida: lucro líquido ÷ receita líquida */
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
  credit: number;
  revenue: number;
  refunds: number;
  taxes: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  fees: number;
  shipping: number;
  net: number;
  margin: number | null;
  /** Alíquota de imposto usada no cálculo (%) */
  taxRate: number;
  units: number;
  unitsWithoutCost: number;
  ordersWithFee: number;
  ordersWithLabelCost: number;
  lossOrders: number;
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
  creditUsed: true,
  paymentFee: true,
  shippingLabelCost: true,
  items: { select: { quantity: true, price: true, product: { select: { costPrice: true } } } },
} as const;

const r2 = (n: number) => Math.round(n * 100) / 100;

export function profitOfOrder(o: ProfitOrderInput, refunded = 0, taxRate = 0): ProfitRow {
  const gross = r2((o.subtotal || 0) + (o.shippingCost || 0));
  const coupon = r2(o.couponDiscount || 0);
  const credit = r2(o.creditUsed || 0);
  // O que sobra entre bruto, total pago, cupom e crédito é o desconto Pix
  const pix = r2(Math.max(0, gross - (o.total || 0) - coupon - credit));
  const revenue = r2(gross - coupon - pix - credit);
  const refunds = r2(refunded);
  // Imposto incide sobre o faturamento menos as devoluções (base do Simples Nacional)
  const taxes = r2(Math.max(0, revenue - refunds) * (taxRate / 100));
  const netRevenue = r2(revenue - refunds - taxes);
  let cogs = 0;
  let itemsWithoutCost = 0;
  for (const it of o.items) {
    const cost = it.product?.costPrice;
    if (cost == null) itemsWithoutCost += it.quantity;
    else cogs += cost * it.quantity;
  }
  cogs = r2(cogs);
  const grossProfit = r2(netRevenue - cogs);
  const fees = r2(o.paymentFee || 0);
  const labelCostKnown = o.shippingLabelCost != null;
  // O frete cobrado do cliente não é da loja: paga a etiqueta. Desconta o custo real da etiqueta
  // (quando registrado) ou, sem ele, o próprio frete cobrado. Frete grátis por cupom já saiu em "cupom".
  const shipping = r2(labelCostKnown ? (o.shippingLabelCost as number) : o.shippingCost || 0);
  const net = r2(grossProfit - fees - shipping);
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    createdAt: new Date(o.createdAt).toISOString(),
    gross, coupon, pix, credit, revenue, refunds, taxes, netRevenue, cogs, grossProfit, fees, shipping, net,
    margin: netRevenue > 0 ? (net / netRevenue) * 100 : null,
    itemsWithoutCost,
    feeKnown: fees > 0,
    labelCostKnown,
  };
}

const SUM_KEYS = ["gross", "coupon", "pix", "credit", "revenue", "refunds", "taxes", "netRevenue", "cogs", "grossProfit", "fees", "shipping", "net"] as const;

export function sumProfit(rows: ProfitRow[], units = 0, taxRate = 0): ProfitTotals {
  const t: ProfitTotals = {
    orders: rows.length, gross: 0, coupon: 0, pix: 0, credit: 0, revenue: 0, refunds: 0, taxes: 0, netRevenue: 0, cogs: 0, grossProfit: 0,
    fees: 0, shipping: 0, net: 0, margin: null, taxRate, units, unitsWithoutCost: 0, ordersWithFee: 0, ordersWithLabelCost: 0, lossOrders: 0,
  };
  for (const r of rows) {
    for (const k of SUM_KEYS) t[k] += r[k];
    t.unitsWithoutCost += r.itemsWithoutCost;
    if (r.feeKnown) t.ordersWithFee++;
    if (r.labelCostKnown) t.ordersWithLabelCost++;
    if (r.net < 0) t.lossOrders++;
  }
  for (const k of SUM_KEYS) t[k] = r2(t[k]);
  t.margin = t.netRevenue > 0 ? (t.net / t.netRevenue) * 100 : null;
  return t;
}

/** Calcula linhas e totais de uma lista de pedidos pagos. `taxRate` = alíquota de imposto sobre vendas (%). */
export function computeProfit(orders: ProfitOrderInput[], refundsByOrder: Map<string, number> = new Map(), taxRate = 0) {
  const rows = orders.map((o) => profitOfOrder(o, refundsByOrder.get(o.id) || 0, taxRate));
  const units = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);
  return { rows, totals: sumProfit(rows, units, taxRate) };
}

/** Alíquota de imposto sobre vendas configurada (%), 0 se não informada. */
export async function getTaxRate(): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const s = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { salesTaxRate: true } }).catch(() => null);
  const v = s?.salesTaxRate ?? 0;
  return Number.isFinite(v) && v > 0 && v < 100 ? v : 0;
}
