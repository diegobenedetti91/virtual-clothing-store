import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCartItems, sendCartReminder } from "@/lib/abandonedCartReminder";

const PAID = ["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "DELIVERED", "RETIRADO"];

export type CartStatus = "open" | "reminded" | "recovered" | "closed";

/**
 * Carrinhos abandonados com o cliente, a situação e — quando o cliente comprou depois do
 * lembrete — o pedido que recuperou a venda.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const carts = await prisma.abandonedCart.findMany({ orderBy: { updatedAt: "desc" }, take: 500 });
  const emails = [...new Set(carts.map((c) => c.email.toLowerCase()))];
  const ids = [...new Set(carts.map((c) => c.customerId).filter((x): x is string => !!x))];
  const oldest = carts.reduce((m, c) => Math.min(m, (c.reminderSentAt ?? c.updatedAt).getTime()), Date.now());

  const [customers, orders] = await Promise.all([
    prisma.customerUser.findMany({
      where: { OR: [{ id: { in: ids } }, { email: { in: emails } }] },
      select: { id: true, email: true, name: true, phone: true },
    }),
    prisma.order.findMany({
      where: {
        status: { in: PAID },
        createdAt: { gte: new Date(oldest) },
        OR: [{ customerId: { in: ids } }, { customerEmail: { in: emails } }],
      },
      select: { id: true, orderNumber: true, total: true, createdAt: true, customerId: true, customerEmail: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const custById = new Map(customers.map((c) => [c.id, c]));
  const custByEmail = new Map(customers.map((c) => [c.email.toLowerCase(), c]));

  const rows = carts.map((c) => {
    const items = parseCartItems(c.cartItems);
    const value = Math.round(items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0) * 100) / 100;
    const cust = (c.customerId && custById.get(c.customerId)) || custByEmail.get(c.email.toLowerCase()) || null;
    const email = c.email.toLowerCase();
    // Recuperado = pedido pago depois do lembrete
    const after = c.reminderSentAt ?? null;
    const recoveredBy = after
      ? orders.find((o) => o.createdAt >= after && ((cust && o.customerId === cust.id) || o.customerEmail?.toLowerCase() === email))
      : undefined;
    const status: CartStatus = recoveredBy ? "recovered" : c.closedAt ? "closed" : c.reminderSent ? "reminded" : "open";
    return {
      id: c.id,
      email: c.email,
      name: cust?.name ?? null,
      phone: cust?.phone ?? null,
      customerId: cust?.id ?? c.customerId ?? null,
      items,
      units: items.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
      value,
      updatedAt: c.updatedAt.toISOString(),
      reminderSentAt: c.reminderSentAt?.toISOString() ?? (c.reminderSent ? c.updatedAt.toISOString() : null),
      status,
      recoveredOrder: recoveredBy ? { id: recoveredBy.id, orderNumber: recoveredBy.orderNumber, total: recoveredBy.total } : null,
    };
  });

  const sum = (st: CartStatus[]) => rows.filter((r) => st.includes(r.status));
  const pendingRows = sum(["open", "reminded"]);
  const remindedTotal = rows.filter((r) => r.reminderSentAt).length;
  const recovered = sum(["recovered"]);
  return NextResponse.json({
    carts: rows,
    summary: {
      openValue: Math.round(pendingRows.reduce((s, r) => s + r.value, 0) * 100) / 100,
      open: sum(["open"]).length,
      reminded: sum(["reminded"]).length,
      recovered: recovered.length,
      recoveredValue: Math.round(recovered.reduce((s, r) => s + (r.recoveredOrder?.total ?? r.value), 0) * 100) / 100,
      recoveryRate: remindedTotal ? (recovered.length / remindedTotal) * 100 : null,
      avgValue: pendingRows.length ? Math.round((pendingRows.reduce((s, r) => s + r.value, 0) / pendingRows.length) * 100) / 100 : 0,
    },
  });
}

/** Envia lembrete: { id } ou { ids: [...] } (até 50 por vez). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { id?: string; ids?: string[] };
  const ids = (Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : []).filter((x) => typeof x === "string").slice(0, 50);
  if (!ids.length) return NextResponse.json({ error: "Nenhum carrinho informado" }, { status: 400 });

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" }, select: { name: true } });
  const storeName = settings?.name || "Minha Loja";

  let sent = 0;
  let failed = 0;
  const sentTo: string[] = [];
  const skipped: string[] = [];
  for (const id of ids) {
    try {
      const r = await sendCartReminder(id, storeName);
      if (r.sent) { sent++; sentTo.push(r.to); } else skipped.push(r.reason);
    } catch (e) {
      failed++;
      console.error("[ABANDONED CART] Falha ao enviar lembrete:", e);
    }
  }
  if (!sent && failed) return NextResponse.json({ error: "O servidor de e-mail recusou o envio. Confira o SMTP da loja." }, { status: 502 });
  return NextResponse.json({ ok: true, sent, failed, sentTo, skipped });
}
