import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const PAID = ["CONFIRMED", "SHIPPED", "PRONTO_PARA_RETIRADA", "DELIVERED", "RETIRADO"];

type CartItem = { name: string; price: number; quantity: number; image?: string; slug?: string; size?: string; color?: string };

function parseItems(raw: string): CartItem[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((i) => i && typeof i.name === "string") : [];
  } catch {
    return [];
  }
}

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
    const items = parseItems(c.cartItems);
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

async function sendReminder(id: string, storeName: string, storeUrl: string) {
  const cart = await prisma.abandonedCart.findUnique({ where: { id } });
  if (!cart || cart.closedAt) return false;
  const items = parseItems(cart.cartItems);
  if (!items.length) return false;
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const esc = (v: string) => v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
  const abs = (u?: string) => (!u ? "" : /^https?:\/\//.test(u) ? u : `${storeUrl}${u}`);

  await sendEmail({
    to: cart.email,
    storeName,
    subject: `Você esqueceu algo na ${storeName}!`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #f0f0f0;">
        <h2 style="color:#ec4899;margin:0 0 8px;">Seus produtos estão esperando por você</h2>
        <p style="color:#555;margin:0 0 20px;">Ainda está pensando? Guardamos o seu carrinho na <strong>${esc(storeName)}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;">
          ${items
            .slice(0, 6)
            .map(
              (i) => `<tr>
                <td style="padding:6px 0;width:56px;">${i.image ? `<img src="${esc(abs(i.image))}" alt="" width="48" height="48" style="border-radius:8px;object-fit:cover;display:block;" />` : ""}</td>
                <td style="padding:6px 8px;color:#333;font-size:14px;">${esc(i.name)} <span style="color:#999;">× ${i.quantity}</span></td>
                <td style="padding:6px 0;text-align:right;font-weight:600;color:#111;font-size:14px;">${brl(i.price * i.quantity)}</td>
              </tr>`
            )
            .join("")}
        </table>
        ${items.length > 6 ? `<p style="color:#888;font-size:12px;margin:4px 0 0;">+ ${items.length - 6} outro(s) item(ns)</p>` : ""}
        <p style="margin:16px 0 0;font-size:18px;font-weight:700;color:#111;text-align:right;">Total: ${brl(total)}</p>
        <p style="text-align:center;margin:24px 0 0;">
          <a href="${storeUrl}/carrinho" style="display:inline-block;padding:12px 28px;background:#ec4899;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Finalizar minha compra</a>
        </p>
        <p style="color:#888;font-size:12px;margin-top:24px;text-align:center;">As peças podem esgotar — garanta a sua. <strong style="color:#ec4899;">${esc(storeName)}</strong></p>
      </div>
    `,
  });
  await prisma.abandonedCart.update({ where: { id }, data: { reminderSent: true, reminderSentAt: new Date() } });
  return true;
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
  const storeUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/+$/, "");

  let sent = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      if (await sendReminder(id, storeName, storeUrl)) sent++;
    } catch (e) {
      failed++;
      console.error("[ABANDONED CART] Falha ao enviar lembrete:", e);
    }
  }
  if (!sent && failed) return NextResponse.json({ error: "Não foi possível enviar o e-mail" }, { status: 502 });
  return NextResponse.json({ ok: true, sent, failed });
}
