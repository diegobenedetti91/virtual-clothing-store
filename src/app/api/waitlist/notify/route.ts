import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/company";
import { sendWaitlistNotificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { productId, size, color } = await req.json();

  if (!productId) {
    return NextResponse.json({ error: "productId obrigatório" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  const settings = await getCompanySettings();
  const storeName = settings?.name || "Loja";

  const entries = await prisma.waitlistEntry.findMany({
    where: {
      productId,
      notified: false,
      ...(size !== undefined ? { size: size || "" } : {}),
      ...(color !== undefined ? { color: color || "" } : {}),
    },
  });

  let sent = 0;
  for (const entry of entries) {
    try {
      await sendWaitlistNotificationEmail({
        to: entry.email,
        customerName: entry.name,
        productName: product.name,
        productSlug: product.slug,
        size: entry.size || undefined,
        color: entry.color || undefined,
        storeName,
      });
      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { notified: true },
      });
      sent++;
    } catch {
      // continue sending to others even if one fails
    }
  }

  return NextResponse.json({ ok: true, sent, total: entries.length });
}
