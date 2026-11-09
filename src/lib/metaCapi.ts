// Meta Conversions API (server side).
// Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
//
// Configured in Admin → Configurações → Meta Ads (CompanySettings):
//   metaPixelId           pixel / dataset id (shared with the browser pixel)
//   metaCapiAccessToken   token generated in Events Manager
//   metaTestEventCode     optional, routes events to "Test events" while validating

import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { CONSENT_COOKIE, isConsentAccepted } from "@/lib/cookieConsent";

const GRAPH_VERSION = "v23.0";
const CONFIG_TTL_MS = 30_000;

interface MetaConfig {
  pixelId: string;
  accessToken: string;
  testEventCode: string | null;
}

let cachedConfig: { value: MetaConfig | null; expires: number } | null = null;

/** Reads the Meta settings from the admin config (cached for 30s). Null = CAPI disabled. */
async function getMetaConfig(): Promise<MetaConfig | null> {
  if (cachedConfig && cachedConfig.expires > Date.now()) return cachedConfig.value;
  const s = await prisma.companySettings
    .findFirst({
      orderBy: { updatedAt: "desc" },
      select: { metaPixelId: true, metaCapiAccessToken: true, metaTestEventCode: true },
    })
    .catch(() => null);
  const value =
    s?.metaPixelId && s.metaCapiAccessToken
      ? { pixelId: s.metaPixelId, accessToken: s.metaCapiAccessToken, testEventCode: s.metaTestEventCode || null }
      : null;
  cachedConfig = { value, expires: Date.now() + CONFIG_TTL_MS };
  return value;
}

export async function isMetaCapiEnabled(): Promise<boolean> {
  return (await getMetaConfig()) !== null;
}

export interface MetaUserInput {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  externalId?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

export interface MetaServerEvent {
  eventName: string;
  eventId: string;
  eventSourceUrl?: string;
  eventTime?: number;
  user: MetaUserInput;
  customData?: Record<string, unknown>;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const stripAccents = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "");

function hashed(value: string | null | undefined, normalize: (v: string) => string): string | undefined {
  if (!value) return undefined;
  const normalized = normalize(value);
  return normalized ? sha256(normalized) : undefined;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  // Brazilian numbers without country code: DDD + 8/9 digits
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

const normalizeName = (v: string) => stripAccents(v.trim().toLowerCase()).replace(/[^a-z\s'-]/g, "");
const normalizeCity = (v: string) => stripAccents(v.toLowerCase()).replace(/[^a-z]/g, "");

function buildUserData(user: MetaUserInput) {
  const nameParts = (user.fullName || "").trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined;

  const em = hashed(user.email, (v) => v.trim().toLowerCase());
  const ph = hashed(user.phone, normalizePhone);

  const data: Record<string, unknown> = {
    em: em ? [em] : undefined,
    ph: ph ? [ph] : undefined,
    fn: hashed(firstName, normalizeName),
    ln: hashed(lastName, normalizeName),
    ct: hashed(user.city, normalizeCity),
    st: hashed(user.state, (v) => v.trim().toLowerCase().slice(0, 2)),
    zp: hashed(user.zip, (v) => v.replace(/\D/g, "")),
    country: user.email || user.phone ? sha256("br") : undefined,
    external_id: hashed(user.externalId, (v) => v.trim()),
    client_ip_address: user.clientIp || undefined,
    client_user_agent: user.userAgent || undefined,
    fbp: user.fbp || undefined,
    fbc: user.fbc || undefined,
  };
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

/** Sends one event to the Conversions API. Never throws; returns false on failure. */
export async function sendMetaEvent(event: MetaServerEvent): Promise<boolean> {
  const config = await getMetaConfig();
  if (!config) return false;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: event.eventSourceUrl,
        user_data: buildUserData(event.user),
        custom_data: event.customData,
      },
    ],
  };
  if (config.testEventCode) payload.test_event_code = config.testEventCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${config.pixelId}/events?access_token=${encodeURIComponent(config.accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) {
      console.error(`[META CAPI] ${event.eventName} failed:`, res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[META CAPI] ${event.eventName} error:`, err);
    return false;
  }
}

export function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || null;
  return req.headers.get("x-real-ip");
}

/** Builds an fbc value from a ?fbclid= in the landing URL when the _fbc cookie is missing. */
export function fbcFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const fbclid = new URL(url).searchParams.get("fbclid");
    return fbclid ? `fb.1.${Date.now()}.${fbclid}` : null;
  } catch {
    return null;
  }
}

/**
 * Browser context captured when an order is created, so the Purchase event sent
 * later by the payment webhook can still be matched to the ad click.
 */
export function hasMarketingConsent(req: NextRequest): boolean {
  return isConsentAccepted(req.cookies.get(CONSENT_COOKIE)?.value);
}

export function getMetaOrderContext(req: NextRequest) {
  if (!hasMarketingConsent(req)) {
    return { metaConsent: false, metaFbp: null, metaFbc: null, clientIp: null, clientUserAgent: null };
  }
  return {
    metaConsent: true,
    metaFbp: req.cookies.get("_fbp")?.value || null,
    metaFbc: req.cookies.get("_fbc")?.value || null,
    clientIp: getClientIp(req),
    clientUserAgent: req.headers.get("user-agent"),
  };
}

export const purchaseEventId = (orderId: string) => `purchase_${orderId}`;

/**
 * Sends the Purchase event for a paid order. Safe to call from every webhook
 * retry: the metaPurchaseSentAt column guarantees it is sent only once.
 * Skipped when the buyer did not accept marketing cookies at checkout.
 */
export async function sendMetaPurchase(orderId: string): Promise<void> {
  if (!(await isMetaCapiEnabled())) return;

  const claimed = await prisma.order.updateMany({
    where: { id: orderId, metaPurchaseSentAt: null, metaConsent: true },
    data: { metaPurchaseSentAt: new Date() },
  });
  if (claimed.count === 0) return;

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;

  const baseUrl = process.env.NEXTAUTH_URL || "";
  const ok = await sendMetaEvent({
    eventName: "Purchase",
    eventId: purchaseEventId(order.id),
    eventSourceUrl: baseUrl ? `${baseUrl}/checkout/sucesso?order=${order.orderNumber}` : undefined,
    user: {
      email: order.customerEmail,
      phone: order.customerPhone,
      fullName: order.customerName,
      city: order.city,
      state: order.state,
      zip: order.zipCode,
      externalId: order.customerId,
      clientIp: order.clientIp,
      userAgent: order.clientUserAgent,
      fbp: order.metaFbp,
      fbc: order.metaFbc,
    },
    customData: {
      currency: "BRL",
      value: order.total,
      order_id: order.orderNumber,
      content_type: "product",
      content_ids: [...new Set(order.items.map((i) => i.productId))],
      contents: order.items.map((i) => ({ id: i.productId, quantity: i.quantity, item_price: i.price })),
      num_items: order.items.reduce((sum, i) => sum + i.quantity, 0),
    },
  });

  // Release the claim so a later webhook retry can try again
  if (!ok) {
    await prisma.order.update({ where: { id: orderId }, data: { metaPurchaseSentAt: null } }).catch(() => {});
  }
}
