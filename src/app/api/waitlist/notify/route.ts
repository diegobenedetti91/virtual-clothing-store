import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/company";
import { sendWaitlistNotificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { productId, variantKey } = await req.json();

  if (!productId) {
    return NextResponse.json({ error: "productId obrigatório" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  const settings = await getCompanySettings();
  const storeName = settings?.name || "Loja";

  const where: Record<string, unknown> = { productId, notified: false };
  if (variantKey !== undefined) where.variantKey = variantKey;

  const entries = await prisma.waitlistEntry.findMany({ where });

  let sent = 0;
  for (const entry of entries) {
    try {
      // Build display label: try to parse variantKey as JSON attributes
      let size: string | undefined;
      let color: string | undefined;
      try {
        const parsed = JSON.parse(entry.variantKey);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          // New format: {Sabor: "Chocolate"} or legacy {size: "P", color: "Preto"}
          if ("size" in parsed || "color" in parsed) {
            size = parsed.size || undefined;
            color = parsed.color || undefined;
          } else {
            // Dynamic attributes: build a label from entries
            size = Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(", ") || undefined;
          }
        }
      } catch {
        size = entry.size || undefined;
        color = entry.color || undefined;
      }

      await sendWaitlistNotificationEmail({
        to: entry.email,
        customerName: entry.name,
        productName: product.name,
        productSlug: product.slug,
        size,
        color,
        storeName,
      });
      await prisma.waitlistEntry.update({ where: { id: entry.id }, data: { notified: true } });
      sent++;
    } catch {
      // continue sending to others even if one fails
    }
  }

  return NextResponse.json({ ok: true, sent, total: entries.length });
}
