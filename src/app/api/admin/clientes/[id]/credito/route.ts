import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCustomerCredit } from "@/lib/cashback";

type Ctx = { params: Promise<{ id: string }> };

/** Saldo e extrato de crédito (cashback) do cliente. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  return NextResponse.json(await getCustomerCredit(id), { headers: { "Cache-Control": "no-store" } });
}

/** Ajuste manual: { amount: number (positivo dá, negativo retira), reason: string } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const { amount, reason } = (await req.json().catch(() => ({}))) as { amount?: number; reason?: string };
  const value = typeof amount === "number" && Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
  if (!value || Math.abs(value) > 100000) return NextResponse.json({ error: "Informe um valor válido" }, { status: 400 });
  const why = typeof reason === "string" ? reason.trim().slice(0, 160) : "";
  if (!why) return NextResponse.json({ error: "Informe o motivo (aparece no extrato do cliente)" }, { status: 400 });

  const customer = await prisma.customerUser.findUnique({ where: { id }, select: { id: true } });
  if (!customer) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  if (value < 0) {
    const { available } = await getCustomerCredit(id);
    if (-value > available) return NextResponse.json({ error: `O cliente só tem R$ ${available.toFixed(2).replace(".", ",")} disponível` }, { status: 400 });
  }
  const session = await auth().catch(() => null);
  await prisma.creditAdjustment.create({ data: { customerId: id, amount: value, reason: why, createdBy: session?.user?.email ?? null } });
  return NextResponse.json(await getCustomerCredit(id));
}
