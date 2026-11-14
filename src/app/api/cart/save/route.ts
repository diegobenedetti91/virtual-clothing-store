import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest } from "@/lib/customerAuth";

// Abandoned-cart snapshot used by the reminder e-mail cron. Only the logged-in
// customer's own cart is saved/cleared: accepting an arbitrary e-mail let anyone
// make the store send attacker-written e-mails to any address, or wipe other carts.

const MAX_ITEMS = 50;

export async function POST(req: NextRequest) {
  const customer = getCustomerFromRequest(req);
  if (!customer) return NextResponse.json({ ok: true });

  const { cartItems } = await req.json().catch(() => ({}));
  if (!Array.isArray(cartItems) || cartItems.length === 0 || cartItems.length > MAX_ITEMS) {
    return NextResponse.json({ ok: true });
  }

  const serialized = JSON.stringify(cartItems);
  if (serialized.length > 50_000) return NextResponse.json({ error: "Carrinho muito grande" }, { status: 400 });

  await prisma.abandonedCart.upsert({
    where: { email: customer.email },
    update: { cartItems: serialized, reminderSent: false, reminderSentAt: null, closedAt: null, customerId: customer.id },
    create: { email: customer.email, cartItems: serialized, customerId: customer.id },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const customer = getCustomerFromRequest(req);
  if (!customer) return NextResponse.json({ ok: true });

  // Carrinho que recebeu lembrete fica guardado como "fechado" para medir se o lembrete recuperou a venda
  await prisma.abandonedCart.updateMany({ where: { email: customer.email, reminderSent: true, closedAt: null }, data: { closedAt: new Date() } });
  await prisma.abandonedCart.deleteMany({ where: { email: customer.email, reminderSent: false } });
  return NextResponse.json({ ok: true });
}
