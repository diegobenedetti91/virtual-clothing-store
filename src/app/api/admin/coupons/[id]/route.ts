import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { parseCouponInput } from "../validate";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await req.json().catch(() => null);

  // Atalho: só ligar/desligar
  if (body && Object.keys(body).length === 1 && typeof body.active === "boolean") {
    const coupon = await prisma.coupon.update({ where: { id }, data: { active: body.active } });
    return NextResponse.json(coupon);
  }

  const parsed = parseCouponInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const current = await prisma.coupon.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Cupom não encontrado" }, { status: 404 });
  if (parsed.data.code !== current.code) {
    // Pedidos guardam o código: trocar o código de um cupom já usado quebraria o histórico
    const used = await prisma.order.count({ where: { couponCode: current.code } });
    if (used > 0) return NextResponse.json({ error: "Este cupom já foi usado em pedidos; o código não pode ser alterado. Crie um novo cupom." }, { status: 400 });
    const clash = await prisma.coupon.findUnique({ where: { code: parsed.data.code } });
    if (clash) return NextResponse.json({ error: `Já existe um cupom com o código ${parsed.data.code}` }, { status: 409 });
  }

  const coupon = await prisma.coupon.update({ where: { id }, data: parsed.data });
  return NextResponse.json(coupon);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  // Os pedidos continuam com o código e o valor do desconto, então o histórico não se perde
  await prisma.coupon.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
