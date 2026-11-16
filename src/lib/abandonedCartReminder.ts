/**
 * Lembrete de carrinho abandonado — um único envio para o botão do admin e a rotina automática.
 *
 * Não envia quando:
 *  - o carrinho foi fechado, está vazio ou sem e-mail;
 *  - o cliente pediu para não receber promoções (LGPD — mesmo "não quero receber" dos avisos de promoção);
 *  - o cliente já fez um pedido depois de montar o carrinho (o carrinho é fechado).
 * Todo lembrete leva o link "Não quero receber".
 */
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site";
import { unsubscribeToken } from "@/lib/promoInterest";

export type CartItem = { name: string; price: number; quantity: number; image?: string; slug?: string; size?: string; color?: string };

export function parseCartItems(raw: string): CartItem[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((i) => i && typeof i.name === "string") : [];
  } catch {
    return [];
  }
}

export type ReminderResult = { sent: true; to: string } | { sent: false; reason: string };

const esc = (v: string) => v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export async function sendCartReminder(cartId: string, storeName: string): Promise<ReminderResult> {
  const cart = await prisma.abandonedCart.findUnique({ where: { id: cartId } });
  if (!cart) return { sent: false, reason: "Carrinho não encontrado." };
  if (cart.closedAt) return { sent: false, reason: "Este carrinho já foi fechado (o cliente finalizou a compra ou ele foi encerrado)." };
  if (!cart.email) return { sent: false, reason: "O carrinho não tem e-mail do cliente." };
  if (!process.env.SMTP_USER) return { sent: false, reason: "E-mail da loja (SMTP) não configurado no servidor." };
  const items = parseCartItems(cart.cartItems);
  if (!items.length) return { sent: false, reason: "O carrinho está vazio." };

  const customer = await prisma.customerUser.findFirst({
    where: cart.customerId ? { id: cart.customerId } : { email: cart.email },
    select: { id: true, name: true, marketingOptOut: true },
  });
  if (customer?.marketingOptOut) {
    return { sent: false, reason: "O cliente pediu para não receber e-mails de promoção (LGPD)." };
  }

  // Comprou depois de montar o carrinho (ex.: a limpeza do carrinho não rodou): não manda "você esqueceu"
  const ordered = await prisma.order.findFirst({
    where: {
      status: { not: "CANCELLED" },
      createdAt: { gte: cart.updatedAt },
      OR: [...(customer ? [{ customerId: customer.id }] : []), { customerEmail: cart.email }],
    },
    select: { orderNumber: true },
  });
  if (ordered) {
    await prisma.abandonedCart.update({ where: { id: cart.id }, data: { closedAt: new Date() } }).catch(() => {});
    return { sent: false, reason: `O cliente já fez o pedido ${ordered.orderNumber} depois de montar este carrinho.` };
  }

  const storeUrl = siteUrl();
  const abs = (u?: string) => (!u ? "" : /^https?:\/\//.test(u) ? u : `${storeUrl}${u}`);
  const total = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0), 0);
  const unsubscribeUrl = customer ? `${storeUrl}/api/promo/sair?t=${encodeURIComponent(unsubscribeToken(customer.id))}` : null;
  const hello = customer?.name ? `Olá, <strong>${esc(customer.name.split(" ")[0])}</strong>! ` : "";

  await sendEmail({
    to: cart.email,
    storeName,
    subject: `Você esqueceu algo na ${storeName}!`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #f0f0f0;">
        <h2 style="color:#ec4899;margin:0 0 8px;">Seus produtos estão esperando por você</h2>
        <p style="color:#555;margin:0 0 20px;">${hello}Ainda está pensando? Guardamos o seu carrinho na <strong>${esc(storeName)}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;">
          ${items
            .slice(0, 6)
            .map(
              (i) => `<tr>
                <td style="padding:6px 0;width:56px;">${i.image ? `<img src="${esc(abs(i.image))}" alt="" width="48" height="48" style="border-radius:8px;object-fit:cover;display:block;" />` : ""}</td>
                <td style="padding:6px 8px;color:#333;font-size:14px;">${esc(i.name)} <span style="color:#999;">× ${Number(i.quantity) || 0}</span></td>
                <td style="padding:6px 0;text-align:right;font-weight:600;color:#111;font-size:14px;">${brl((Number(i.price) || 0) * (Number(i.quantity) || 0))}</td>
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
        ${unsubscribeUrl ? `<p style="color:#aaa;font-size:11px;text-align:center;margin:18px 0 0;">Você recebeu este e-mail porque deixou produtos no carrinho da loja. <a href="${esc(unsubscribeUrl)}" style="color:#aaa;">Não quero receber promoções</a>.</p>` : ""}
      </div>
    `,
  });
  await prisma.abandonedCart.update({ where: { id: cart.id }, data: { reminderSent: true, reminderSentAt: new Date() } });
  return { sent: true, to: cart.email };
}
