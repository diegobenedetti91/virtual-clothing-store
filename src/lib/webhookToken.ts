import { createHmac, timingSafeEqual } from "crypto";

// Gateways without signed webhooks (NuPay, InfinityPay) get a per-order secret in
// the notification URL we hand them. Only the gateway knows that URL, so a forged
// "paid" notification without the right token is rejected.

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET/NEXTAUTH_SECRET não configurado");
  return s;
}

export function webhookToken(orderNumber: string): string {
  return createHmac("sha256", secret()).update(`webhook:${orderNumber}`).digest("base64url");
}

export function verifyWebhookToken(orderNumber: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(webhookToken(orderNumber));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
