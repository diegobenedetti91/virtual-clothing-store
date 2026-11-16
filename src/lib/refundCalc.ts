/**
 * Quanto devolver numa devolução de peças — pelo que o cliente REALMENTE pagou por elas.
 *
 * O preço gravado no item é o preço cheio. Se o pedido teve cupom, desconto Pix ou crédito
 * de cashback, o cliente pagou menos por cada peça; devolver o preço cheio faria a loja
 * estornar a mais. Aqui o desconto é rateado proporcionalmente entre as peças:
 *
 *   pago em dinheiro pelos produtos = subtotal − cupom (parte dos produtos) − Pix − crédito
 *   estorno em dinheiro = pago em dinheiro pelos produtos × (valor cheio devolvido ÷ subtotal)
 *   volta como crédito  = crédito usado × (valor cheio devolvido ÷ subtotal)
 *
 * O frete não é estornado numa devolução parcial de peças (o envio aconteceu).
 * O total já estornado em devoluções anteriores limita o novo estorno (nunca passa do pago).
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface RefundOrderInput {
  subtotal: number;
  shippingCost: number;
  total: number;
  couponDiscount: number;
  /** Cupom de frete grátis: o desconto do cupom foi no frete, não nos produtos */
  freeShippingCoupon: boolean;
  creditUsed: number;
}

export interface RefundSplit {
  /** Valor cheio das peças devolvidas (preço de tabela × quantidade) */
  listValue: number;
  /** Estorno em dinheiro (gateway) */
  money: number;
  /** Devolvido como crédito na conta */
  credit: number;
}

export function productsPaidInMoney(o: RefundOrderInput): number {
  const couponItems = Math.max(0, o.couponDiscount - (o.freeShippingCoupon ? o.shippingCost : 0));
  // O que sobra entre bruto, total pago, cupom e crédito é o desconto Pix
  const pix = Math.max(0, o.subtotal + o.shippingCost - o.total - o.couponDiscount - o.creditUsed);
  return Math.max(0, r2(o.subtotal - couponItems - pix - o.creditUsed));
}

/**
 * Divide o estorno de uma devolução.
 * `alreadyRefundedMoney` / `alreadyRefundedCredit`: o que outras devoluções aprovadas já devolveram.
 * `alreadyListValue`: valor cheio das peças já devolvidas antes (para a última devolução fechar a conta no centavo).
 */
export function splitReturnRefund(
  o: RefundOrderInput,
  listValue: number,
  alreadyRefundedMoney = 0,
  alreadyRefundedCredit = 0,
  alreadyListValue = 0
): RefundSplit {
  if (o.subtotal <= 0 || listValue <= 0) return { listValue: r2(listValue), money: 0, credit: 0 };
  const share = Math.min(1, listValue / o.subtotal);
  const moneyCap = r2(Math.max(0, productsPaidInMoney(o) - alreadyRefundedMoney));
  const creditCap = r2(Math.max(0, o.creditUsed - alreadyRefundedCredit));
  // Devolveu todas as peças: estorna exatamente o que falta (sem sobra de centavo do arredondamento)
  if (alreadyListValue + listValue >= o.subtotal - 0.005) return { listValue: r2(listValue), money: moneyCap, credit: creditCap };
  return {
    listValue: r2(listValue),
    money: r2(Math.min(moneyCap, productsPaidInMoney(o) * share)),
    credit: r2(Math.min(creditCap, o.creditUsed * share)),
  };
}
