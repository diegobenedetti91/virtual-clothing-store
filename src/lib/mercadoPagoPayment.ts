/**
 * Lê do pagamento do Mercado Pago (GET /v1/payments/:id) a taxa cobrada da loja,
 * o valor líquido e a forma de pagamento.
 *
 * O MP não tem um campo `fee`: a taxa vem em `fee_details` (só conta o que é pago
 * pelo vendedor, `fee_payer = "collector"`) e o líquido em
 * `transaction_details.net_received_amount`.
 */
export interface MpPaymentDetails {
  fee: number;
  net: number | null;
  paymentType: string | null;
  installments: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const TYPE_MAP: Record<string, string> = {
  credit_card: "credit_card",
  debit_card: "debit_card",
  prepaid_card: "debit_card",
  ticket: "boleto",
  atm: "boleto",
  account_money: "account_money",
  digital_currency: "account_money",
  digital_wallet: "account_money",
};

export function extractMpPaymentDetails(payment: Record<string, unknown>): MpPaymentDetails {
  const feeDetails = Array.isArray(payment.fee_details) ? (payment.fee_details as { amount?: number; fee_payer?: string }[]) : [];
  let fee = feeDetails.filter((f) => (f.fee_payer ?? "collector") === "collector").reduce((s, f) => s + (Number(f.amount) || 0), 0);

  const td = (payment.transaction_details || {}) as { net_received_amount?: number };
  const gross = Number(payment.transaction_amount) || 0;
  const net = typeof td.net_received_amount === "number" ? td.net_received_amount : null;
  // Sem fee_details, a diferença entre bruto e líquido é a taxa
  if (fee === 0 && net != null && gross > net) fee = gross - net;

  const methodId = String(payment.payment_method_id || "");
  const typeId = String(payment.payment_type_id || "");
  const paymentType = methodId === "pix" || typeId === "bank_transfer" ? "pix" : TYPE_MAP[typeId] ?? (typeId || null);
  const installments = Number(payment.installments) || null;

  return { fee: round2(fee), net: net != null ? round2(net) : null, paymentType, installments };
}

export const PAYMENT_TYPE_LABEL: Record<string, string> = {
  pix: "Pix",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  boleto: "Boleto",
  account_money: "Saldo Mercado Pago",
};
