import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customerAuth";
import { fbcFromUrl, getClientIp, hasMarketingConsent, isMetaCapiEnabled, sendMetaEvent } from "@/lib/metaCapi";

// Receives browser pixel events and forwards them to the Conversions API with the
// same event_id. Purchase is not accepted here: it is sent by the payment webhooks.
const ALLOWED_EVENTS = new Set(["ViewContent", "AddToCart", "InitiateCheckout"]);

const RATE_LIMIT = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = RATE_LIMIT.get(ip);
  if (!bucket || now > bucket.reset) {
    RATE_LIMIT.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  bucket.count++;
  return bucket.count > 60;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const str = (v: unknown, max = 200) => (typeof v === "string" && v.length <= max ? v : undefined);

function sanitizeCustomData(raw: unknown) {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  const contents = Array.isArray(d.contents)
    ? d.contents.slice(0, 50).flatMap((c) => {
        const id = str((c as Record<string, unknown>)?.id, 100);
        const quantity = num((c as Record<string, unknown>)?.quantity);
        if (!id || quantity === undefined) return [];
        return [{ id, quantity, item_price: num((c as Record<string, unknown>)?.item_price) }];
      })
    : undefined;
  const contentIds = Array.isArray(d.content_ids)
    ? d.content_ids.slice(0, 50).filter((id): id is string => typeof id === "string" && id.length <= 100)
    : undefined;
  const data = {
    currency: str(d.currency, 3) ?? "BRL",
    value: num(d.value),
    content_type: d.content_type === "product_group" ? "product_group" : "product",
    content_ids: contentIds,
    content_name: str(d.content_name),
    contents,
    num_items: num(d.num_items),
  };
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

export async function POST(req: NextRequest) {
  if (!hasMarketingConsent(req) || !(await isMetaCapiEnabled())) return new NextResponse(null, { status: 204 });

  const ip = getClientIp(req);
  if (rateLimited(ip || "unknown")) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const eventName = str(body?.eventName, 50);
  const eventId = str(body?.eventId, 100);
  if (!eventName || !ALLOWED_EVENTS.has(eventName) || !eventId) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const eventSourceUrl = str(body?.eventSourceUrl, 2000);
  const customer = getCustomerFromRequest(req);

  await sendMetaEvent({
    eventName,
    eventId,
    eventSourceUrl,
    user: {
      email: customer?.email,
      fullName: customer?.name,
      externalId: customer?.id,
      clientIp: ip,
      userAgent: req.headers.get("user-agent"),
      fbp: req.cookies.get("_fbp")?.value,
      fbc: req.cookies.get("_fbc")?.value || fbcFromUrl(eventSourceUrl),
    },
    customData: sanitizeCustomData(body?.customData),
  });

  return new NextResponse(null, { status: 204 });
}
