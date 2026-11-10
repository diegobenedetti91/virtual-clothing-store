// Mercado Pago transparent checkout (Payment Brick): the card/Pix form is shown
// inside the store and the payment is created here via POST /v1/payments.

/** Order.paymentMethod for orders paid through the in-site form. */
export const MP_TRANSPARENT_LABEL = "Mercado Pago (no site)";

/** Pix QR code validity. */
export const PIX_EXPIRATION_MINUTES = 30;

// Mercado Pago status_detail -> message for the buyer
const REJECTION_MESSAGES: Record<string, string> = {
  cc_rejected_bad_filled_card_number: "Confira o número do cartão.",
  cc_rejected_bad_filled_date: "Confira a data de validade do cartão.",
  cc_rejected_bad_filled_security_code: "Confira o código de segurança (CVV) do cartão.",
  cc_rejected_bad_filled_other: "Confira os dados do cartão.",
  cc_rejected_blacklist: "Não foi possível processar o pagamento com este cartão. Use outro cartão ou o Pix.",
  cc_rejected_call_for_authorize: "O banco emissor precisa autorizar este pagamento. Ligue para o banco do cartão e tente novamente.",
  cc_rejected_card_disabled: "O cartão não está ativo. Ligue para o banco emissor para ativá-lo ou use outro cartão.",
  cc_rejected_duplicated_payment: "Você já fez um pagamento com esse valor. Se precisar pagar de novo, use outro cartão ou o Pix.",
  cc_rejected_high_risk: "O pagamento foi recusado pela análise de segurança. Use outro cartão ou o Pix.",
  cc_rejected_insufficient_amount: "O cartão não tem limite suficiente. Use outro cartão ou o Pix.",
  cc_rejected_invalid_installments: "O cartão não aceita esse número de parcelas. Escolha outra opção.",
  cc_rejected_max_attempts: "Você atingiu o limite de tentativas. Use outro cartão ou o Pix.",
  cc_rejected_other_reason: "O banco emissor recusou o pagamento. Use outro cartão ou o Pix.",
};

export function rejectionMessage(statusDetail: string | undefined): string {
  return (statusDetail && REJECTION_MESSAGES[statusDetail]) || "O pagamento foi recusado. Confira os dados ou use outra forma de pagamento.";
}

/** Mercado Pago expects "yyyy-MM-ddTHH:mm:ss.SSS-03:00". */
export function mpDate(date: Date): string {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().replace("Z", "-03:00");
}
