import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RATE_LIMIT = new Map<string, { count: number; reset: number }>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  // Rate limit: 100 events per minute per IP
  const now = Date.now();
  const bucket = RATE_LIMIT.get(ip) || { count: 0, reset: now + 60000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60000;
  }
  if (bucket.count > 100) {
    RATE_LIMIT.set(ip, bucket);
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  bucket.count++;
  RATE_LIMIT.set(ip, bucket);

  const { type, productId, sessionId, customerId, orderId, path, value } = await req.json();

  if (!type) {
    return NextResponse.json({ error: "Missing type" }, { status: 400 });
  }

  try {
    const event = await prisma.analyticsEvent.create({
      data: {
        type,
        productId: productId || null,
        sessionId: sessionId || null,
        customerId: customerId || null,
        orderId: orderId || null,
        path: path || null,
        value: value || null,
      },
    });
    return NextResponse.json(event);
  } catch (error) {
    console.error("Track error:", error);
    return NextResponse.json({ error: "Failed to track" }, { status: 500 });
  }
}
