// NuPay for Business — official checkout API.
// Docs: https://docs.nupaybusiness.com.br/checkout/docs/openapi/index.html
//
// Auth: X-Merchant-Key + X-Merchant-Token headers (configured in Admin →
// Configurações → NuPay). Amounts are decimal reais (e.g. 10.01).

import { prisma } from "@/lib/prisma";

const PRODUCTION_URL = "https://api.spinpay.com.br";
const SANDBOX_URL = "https://sandbox-api.spinpay.com.br";

export interface NuPayConfig {
  baseUrl: string;
  merchantKey: string;
  merchantToken: string;
}

export async function getNuPayConfig(): Promise<NuPayConfig | null> {
  const s = await prisma.companySettings.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { nuPayClientId: true, nuPayClientSecret: true, nuPaySandbox: true },
  });
  // nuPayClientId / nuPayClientSecret hold the Merchant Key / Merchant Token
  if (!s?.nuPayClientId || !s.nuPayClientSecret) return null;
  return {
    baseUrl: s.nuPaySandbox ? SANDBOX_URL : PRODUCTION_URL,
    merchantKey: s.nuPayClientId,
    merchantToken: s.nuPayClientSecret,
  };
}

async function nupayFetch(config: NuPayConfig, path: string, init: { method: string; body?: unknown }) {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Merchant-Key": config.merchantKey,
      "X-Merchant-Token": config.merchantToken,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as Record<string, unknown> };
}

// ---- Payments ---------------------------------------------------------------

export interface NuPayCreatePayment {
  merchantOrderReference: string;
  referenceId: string;
  amount: { value: number; currency: "BRL" };
  shopper: Record<string, unknown>;
  items: { id: string; description: string; value: number; quantity: number }[];
  paymentMethod: { type: "nupay" };
  paymentFlow: { returnUrl: string; cancelUrl: string };
  callbackUrl?: string;
  delayToAutoCancel?: number;
  merchantName?: string;
  shipping?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
}

export async function createNuPayPayment(config: NuPayConfig, payload: NuPayCreatePayment) {
  const r = await nupayFetch(config, "/v1/checkouts/payments", { method: "POST", body: payload });
  if (!r.ok) {
    console.error("[NUPAY] Create payment failed:", r.status, r.data);
    return null;
  }
  const pspReferenceId = typeof r.data.pspReferenceId === "string" ? r.data.pspReferenceId : null;
  const paymentUrl = typeof r.data.paymentUrl === "string" ? r.data.paymentUrl : null;
  if (!pspReferenceId || !paymentUrl) {
    console.error("[NUPAY] Create payment: missing pspReferenceId/paymentUrl", r.data);
    return null;
  }
  return { pspReferenceId, paymentUrl };
}

export interface NuPayStatus {
  status: string; // WAITING_PAYMENT_METHOD | AUTHORIZED | COMPLETED | CANCELLED | ERROR
  referenceId?: string;
  amount?: number;
}

export async function getNuPayPaymentStatus(config: NuPayConfig, pspReferenceId: string): Promise<NuPayStatus | null> {
  const r = await nupayFetch(config, `/v1/checkouts/payments/${encodeURIComponent(pspReferenceId)}/status`, { method: "GET" });
  if (!r.ok || typeof r.data.status !== "string") {
    console.error("[NUPAY] Status query failed:", r.status, r.data);
    return null;
  }
  const amount = (r.data.amount as { value?: unknown } | undefined)?.value;
  return {
    status: r.data.status,
    referenceId: typeof r.data.referenceId === "string" ? r.data.referenceId : undefined,
    amount: typeof amount === "number" ? amount : undefined,
  };
}

/** NuPay payment status → order status. Unknown/intermediate statuses keep the order as it is. */
export function mapNuPayStatus(status: string): "CONFIRMED" | "PENDING" | "CANCELLED" | null {
  switch (status) {
    case "COMPLETED":
      return "CONFIRMED";
    case "WAITING_PAYMENT_METHOD":
    case "AUTHORIZED":
      return "PENDING";
    case "CANCELLED":
    case "ERROR":
      return "CANCELLED";
    default:
      return null;
  }
}

// ---- Refunds ----------------------------------------------------------------

/** Full or partial refund. `refundKey` must be unique per refund (idempotency on NuPay's side). */
export async function refundNuPayPayment(pspReferenceId: string, amount: number, refundKey: string, notes?: string): Promise<void> {
  const config = await getNuPayConfig();
  if (!config) throw new Error("NuPay não configurado");
  const r = await nupayFetch(config, `/v1/checkouts/payments/${encodeURIComponent(pspReferenceId)}/refunds`, {
    method: "POST",
    body: {
      transactionRefundId: refundKey,
      amount: { value: Math.round(amount * 100) / 100, currency: "BRL" },
      ...(notes ? { notes } : {}),
    },
  });
  if (!r.ok || r.data.status === "ERROR") {
    throw new Error(`Erro ao reembolsar no NuPay (HTTP ${r.status})`);
  }
}
