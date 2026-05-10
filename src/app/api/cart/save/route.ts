import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest } from "@/lib/customerAuth";

export async function POST(req: NextRequest) {
  const customer = getCustomerFromRequest(req);
  const { email, cartItems } = await req.json();

  const resolvedEmail = customer?.email || email?.trim();
  if (!resolvedEmail || !cartItems?.length) {
    return NextResponse.json({ ok: true });
  }

  await prisma.abandonedCart.upsert({
    where: { email: resolvedEmail },
    update: { cartItems: JSON.stringify(cartItems), reminderSent: false, customerId: customer?.id || null },
    create: { email: resolvedEmail, cartItems: JSON.stringify(cartItems), customerId: customer?.id || null },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const customer = getCustomerFromRequest(req);
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email") || customer?.email;
  if (!email) return NextResponse.json({ ok: true });

  await prisma.abandonedCart.deleteMany({ where: { email } });
  return NextResponse.json({ ok: true });
}
