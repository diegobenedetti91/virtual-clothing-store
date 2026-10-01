import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyShipmentUpdate } from "@/lib/trackingSync";

type RawEvent = {
  event?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

// Melhor Envio sends { event: "order.posted", data: { id, status, tracking, ... } }; flat { id, status } kept for compatibility.
function normalizeEvent(raw: RawEvent) {
  const data = raw?.data && typeof raw.data === "object" ? raw.data : raw;
  const statusFromEvent =
    typeof raw?.event === "string" && raw.event.startsWith("order.") ? raw.event.slice("order.".length) : undefined;
  return {
    id: data?.id as string | undefined,
    status: (data?.status as string | undefined) || statusFromEvent,
    // Some carriers (e.g. Loggi) only fill self_tracking
    tracking: (data?.tracking || data?.self_tracking) as string | undefined,
    timeline: Array.isArray(data?.timeline)
      ? (data.timeline as { status: string; location?: string; date: string; detail?: string }[])
      : undefined,
  };
}

// X-ME-Signature = base64(HMAC-SHA256(raw body, app client secret))
function isValidSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    const secret = process.env.MELHOR_ENVIO_WEBHOOK_SECRET;
    if (secret) {
      if (!isValidSignature(rawBody, req.headers.get("x-me-signature"), secret)) {
        console.warn("[MELHOR ENVIO WEBHOOK] Invalid signature, rejecting request");
        return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
      }
    } else {
      console.warn("[MELHOR ENVIO WEBHOOK] MELHOR_ENVIO_WEBHOOK_SECRET not set, skipping signature check");
    }

    const body = JSON.parse(rawBody);
    console.log("[MELHOR ENVIO WEBHOOK] Received:", JSON.stringify(body, null, 2));

    const events: RawEvent[] = Array.isArray(body) ? body : [body];
    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { name: true } });
    const storeName = settings?.name || "Minha Loja";

    for (const raw of events) {
      await processWebhookEvent(raw, storeName);
    }

    return NextResponse.json({ success: true, processed: events.length });
  } catch (error) {
    console.error("[MELHOR ENVIO WEBHOOK] Error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

async function processWebhookEvent(raw: RawEvent, storeName: string) {
  try {
    const event = normalizeEvent(raw);
    if (!event.id || !event.status) {
      console.warn("[WEBHOOK] Ignoring event without shipment id/status:", raw?.event);
      return;
    }

    console.log(`[WEBHOOK] Processing shipment ${event.id} with status ${event.status}`);

    const order = await prisma.order.findFirst({
      where: { melhorEnvioShipmentId: event.id },
      select: { id: true, orderNumber: true },
    });

    if (!order) {
      console.log(`[WEBHOOK] No order found for shipment ${event.id}`);
      return;
    }

    const result = await applyShipmentUpdate(
      order.id,
      { shipmentStatus: event.status, trackingCode: event.tracking, timeline: event.timeline },
      storeName
    );

    console.log(`[WEBHOOK] Processed ${order.orderNumber}`, result);
  } catch (error) {
    console.error(`[WEBHOOK] Error processing event:`, error);
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook do Melhor Envio está ativo",
    endpoint: "/api/webhooks/melhorenvio",
  });
}
