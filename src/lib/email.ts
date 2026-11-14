import nodemailer from "nodemailer";
import path from "path";
import { prisma } from "@/lib/prisma";

// User-controlled text (names, reasons, notes) must never be injected as raw HTML
// into e-mails sent from the store's own address.
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const port = Number(process.env.SMTP_PORT) || 587;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port,
  secure: port === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

// Templates are written with the default pink palette; at send time those hex codes are swapped for the store's colors
// from Configurações (primaryColor / buttonColor), so every email, including HTML built by callers of sendEmail, follows the brand.
const DEFAULT_PRIMARY = "#ec4899";
const DEFAULT_PRIMARY_DARK = "#be185d";
const DEFAULT_PRIMARY_LIGHT = "#fdf2f8";

function normalizeHex(color: string | null | undefined): string | null {
  if (!color) return null;
  const c = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`.toLowerCase();
  return null;
}

// amount > 0 mixes toward white, < 0 toward black
function mixHex(hex: string, amount: number): string {
  const target = amount > 0 ? 255 : 0;
  const a = Math.abs(amount);
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(v + (target - v) * a).toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

async function applyBrandColors(html: string): Promise<string> {
  const settings = await prisma.companySettings
    .findFirst({ orderBy: { updatedAt: "desc" }, select: { primaryColor: true, buttonColor: true } })
    .catch(() => null);
  const primary = normalizeHex(settings?.primaryColor) || DEFAULT_PRIMARY;
  const button = normalizeHex(settings?.buttonColor) || primary;

  return html
    .replace(new RegExp(`background:\\s*${DEFAULT_PRIMARY}`, "gi"), `background:${button}`)
    .replace(new RegExp(DEFAULT_PRIMARY, "gi"), primary)
    .replace(new RegExp(DEFAULT_PRIMARY_DARK, "gi"), primary === DEFAULT_PRIMARY ? DEFAULT_PRIMARY_DARK : mixHex(primary, -0.2))
    .replace(new RegExp(DEFAULT_PRIMARY_LIGHT, "gi"), primary === DEFAULT_PRIMARY ? DEFAULT_PRIMARY_LIGHT : mixHex(primary, 0.92));
}

async function sendMail(options: Parameters<typeof transporter.sendMail>[0]) {
  const html = typeof options.html === "string" ? await applyBrandColors(options.html) : options.html;
  return transporter.sendMail({ ...options, html });
}

const STATUS_PT: Record<string, string> = {
  PENDING: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

function baseWrapper(content: string, storeName: string) {
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #f0f0f0;">
    ${content}
    <p style="color:#888;font-size:13px;text-align:center;margin:24px 0 0;">
      Em caso de dúvidas, entre em contato com a loja.<br/>
      <strong style="color:#ec4899;">${storeName}</strong>
    </p>
  </div>`;
}

export async function sendEmail({
  to, subject, html, storeName,
  attachmentPath, attachmentName,
}: {
  to: string; subject: string; html: string; storeName: string;
  attachmentPath?: string; attachmentName?: string;
}) {
  if (!process.env.SMTP_USER) return;
  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments: attachmentPath ? [{ filename: attachmentName || "comprovante.pdf", path: attachmentPath }] : [],
  });
}

export async function sendOrderConfirmationEmail({
  to, customerName, orderNumber, storeName, items, total, isGateway,
}: {
  to: string; customerName: string; orderNumber: string; storeName: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  isGateway?: boolean;
}) {
  if (!process.env.SMTP_USER) return;

  const itemsHtml = items
    .map((i) => `<tr><td style="padding:6px 0;color:#444;">${esc(i.name)}</td><td style="padding:6px 0;color:#888;text-align:center;">${i.quantity}×</td><td style="padding:6px 0;font-weight:600;color:#111;text-align:right;">R$ ${(i.price * i.quantity).toFixed(2).replace(".", ",")}</td></tr>`)
    .join("");

  const nextStep = isGateway
    ? `<p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;color:#166534;font-size:13px;margin:0;">✅ <strong>Pagamento confirmado!</strong> Seu pedido foi recebido e está sendo preparado.</p>`
    : `<p style="background:#fef9c3;border:1px solid #fef08a;border-radius:8px;padding:12px 16px;color:#854d0e;font-size:13px;margin:0;">💬 <strong>Pedido recebido!</strong> Nossa equipe entrará em contato via WhatsApp em breve para confirmar pagamento e entrega.</p>`;

  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 4px;">Pedido realizado!</h2>
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${esc(customerName)}</strong>! Recebemos seu pedido com sucesso.</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Número do pedido</p>
      <p style="margin:0;font-weight:700;font-size:20px;color:#be185d;">${orderNumber}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">${itemsHtml}</table>
    <div style="border-top:1px solid #f0f0f0;padding-top:10px;text-align:right;">
      <span style="font-size:16px;font-weight:700;color:#111;">Total: R$ ${total.toFixed(2).replace(".", ",")}</span>
    </div>

    <div style="margin-top:20px;">${nextStep}</div>
  `, storeName);

  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `Pedido ${orderNumber} recebido — ${storeName}`,
    html,
  });
}

/** E-mail com a nota fiscal autorizada (DANFE em PDF + XML anexos). */
export async function sendInvoiceEmail({
  to, customerName, orderNumber, storeName, numero, serie, chave, orderUrl, attachments,
}: {
  to: string; customerName: string; orderNumber: string; storeName: string;
  numero: string | null; serie: string | null; chave: string; orderUrl: string;
  attachments: { filename: string; content: Buffer }[];
}) {
  if (!process.env.SMTP_USER) return;
  const chaveFmt = chave.replace(/(\d{4})(?=\d)/g, "$1 ");
  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 4px;">Sua nota fiscal chegou</h2>
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${esc(customerName)}</strong>! A nota fiscal do seu pedido foi emitida e está anexada a este e-mail (DANFE em PDF e arquivo XML).</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="color:#888;padding:3px 0;">Pedido</td><td style="text-align:right;font-weight:700;color:#be185d;">${esc(orderNumber)}</td></tr>
        ${numero ? `<tr><td style="color:#888;padding:3px 0;">Nota fiscal</td><td style="text-align:right;font-weight:600;color:#111;">Nº ${esc(numero)}${serie ? ` · Série ${esc(serie)}` : ""}</td></tr>` : ""}
      </table>
      <p style="margin:10px 0 0;font-size:11px;color:#888;">Chave de acesso</p>
      <p style="margin:2px 0 0;font-family:monospace;font-size:12px;color:#333;word-break:break-all;">${esc(chaveFmt)}</p>
    </div>

    <p style="text-align:center;margin:20px 0 4px;">
      <a href="${esc(orderUrl)}" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;font-size:14px;">Acompanhar meu pedido</a>
    </p>
    <p style="color:#888;font-size:12px;text-align:center;margin:12px 0 0;">Guarde este e-mail: a nota é o seu comprovante para trocas e garantia. Você também pode consultá-la no portal da NF-e com a chave acima.</p>
  `, storeName);

  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `Nota fiscal do pedido ${orderNumber} — ${storeName}`,
    html,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.filename.endsWith(".pdf") ? "application/pdf" : "application/xml",
    })),
  });
}

const brlMail = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const dateMail = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

/** Cashback liberado: crédito disponível para a próxima compra. */
export async function sendCashbackReleasedEmail({
  to, customerName, storeName, released, available, expiresAt, shopUrl,
}: {
  to: string; customerName: string; storeName: string; released: number; available: number; expiresAt: Date | string | null; shopUrl: string;
}) {
  if (!process.env.SMTP_USER) return;
  const html = baseWrapper(`
    <h2 style="color:#7c3aed;margin:0 0 4px;">Seu cashback chegou! 💜</h2>
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${esc(customerName)}</strong>! Liberamos <strong>${brlMail(released)}</strong> de crédito na sua conta para usar na próxima compra.</p>
    <div style="background:#f5f3ff;border-radius:12px;padding:18px 20px;margin-bottom:18px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#6d28d9;text-transform:uppercase;letter-spacing:.05em;">Crédito disponível</p>
      <p style="margin:4px 0 0;font-weight:800;font-size:28px;color:#4c1d95;">${brlMail(available)}</p>
      ${expiresAt ? `<p style="margin:6px 0 0;font-size:12px;color:#6d28d9;">Use até ${dateMail(expiresAt)}</p>` : ""}
    </div>
    <p style="text-align:center;margin:0 0 6px;">
      <a href="${esc(shopUrl)}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;font-size:14px;">Usar meu crédito</a>
    </p>
    <p style="color:#888;font-size:12px;text-align:center;margin:10px 0 0;">No checkout, marque “Usar meu crédito” e o desconto é aplicado na hora.</p>
  `, storeName);
  await sendMail({ from: `"${storeName}" <${process.env.SMTP_USER}>`, to, subject: `Você ganhou ${brlMail(released)} de crédito — ${storeName}`, html });
}

/** Lembrete: crédito vai vencer. */
export async function sendCashbackExpiringEmail({
  to, customerName, storeName, amount, expiresAt, shopUrl,
}: {
  to: string; customerName: string; storeName: string; amount: number; expiresAt: Date | string; shopUrl: string;
}) {
  if (!process.env.SMTP_USER) return;
  const html = baseWrapper(`
    <h2 style="color:#7c3aed;margin:0 0 4px;">Seu crédito está quase vencendo ⏳</h2>
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${esc(customerName)}</strong>! Você tem <strong>${brlMail(amount)}</strong> de crédito que vence em <strong>${dateMail(expiresAt)}</strong>. Não deixe passar!</p>
    <p style="text-align:center;margin:0 0 6px;">
      <a href="${esc(shopUrl)}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;font-size:14px;">Ver novidades e usar o crédito</a>
    </p>
  `, storeName);
  await sendMail({ from: `"${storeName}" <${process.env.SMTP_USER}>`, to, subject: `Seu crédito de ${brlMail(amount)} vence em breve — ${storeName}`, html });
}

/** "O produto que você viu está em promoção" — com link de descadastro (LGPD). */
export async function sendPromoProductEmail({
  to, customerName, storeName, offer, productUrl, unsubscribeUrl, imageUrl,
}: {
  to: string; customerName: string; storeName: string; productUrl: string; unsubscribeUrl: string; imageUrl: string | null;
  offer: { reason: string; product: { name: string }; priceBefore: number | null; priceNow: number; headline: string; detail: string; couponCode: string | null; endsAt: string | null };
}) {
  if (!process.env.SMTP_USER) return;
  const first = esc(customerName.split(" ")[0] || customerName);
  const intro =
    offer.reason === "PRICE_DROP" ? "Aquela peça que você olhou baixou de preço:"
    : offer.reason === "FLASH_SALE" ? "Aquela peça que você olhou entrou em promoção relâmpago — corre que é por pouco tempo:"
    : "Separamos um cupom para aquela peça que você olhou:";
  const price = offer.priceBefore && offer.priceBefore > offer.priceNow
    ? `<p style="margin:6px 0 0;"><span style="color:#999;text-decoration:line-through;font-size:14px;">${brlMail(offer.priceBefore)}</span> <strong style="color:#111;font-size:22px;">${brlMail(offer.priceNow)}</strong></p>`
    : `<p style="margin:6px 0 0;"><strong style="color:#111;font-size:20px;">${brlMail(offer.priceNow)}</strong></p>`;
  const coupon = offer.couponCode
    ? `<p style="margin:12px 0 0;"><span style="display:inline-block;border:2px dashed #ec4899;color:#be185d;font-weight:800;letter-spacing:.08em;padding:8px 14px;border-radius:8px;font-family:monospace;font-size:16px;">${esc(offer.couponCode)}</span></p>`
    : "";
  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 4px;">${esc(offer.headline)}</h2>
    <p style="color:#555;margin:0 0 18px;">Oi, <strong>${first}</strong>! ${intro}</p>
    <div style="border:1px solid #f0f0f0;border-radius:14px;overflow:hidden;margin-bottom:18px;">
      ${imageUrl ? `<a href="${esc(productUrl)}"><img src="${esc(imageUrl)}" alt="" width="472" style="display:block;width:100%;max-height:420px;object-fit:cover;" /></a>` : ""}
      <div style="padding:16px 18px;">
        <p style="margin:0;font-weight:700;color:#111;font-size:16px;">${esc(offer.product.name)}</p>
        ${price}
        <p style="margin:6px 0 0;color:#666;font-size:13px;">${esc(offer.detail)}</p>
        ${coupon}
      </div>
    </div>
    <p style="text-align:center;margin:0 0 6px;">
      <a href="${esc(productUrl)}" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:10px;font-size:15px;">Quero aproveitar</a>
    </p>
    ${offer.endsAt ? `<p style="color:#888;font-size:12px;text-align:center;margin:8px 0 0;">Válido até ${new Date(offer.endsAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} ou enquanto durar o estoque.</p>` : `<p style="color:#888;font-size:12px;text-align:center;margin:8px 0 0;">Enquanto durar o estoque.</p>`}
    <p style="color:#aaa;font-size:11px;text-align:center;margin:18px 0 0;">Você recebeu este e-mail porque se interessou por este produto na loja. <a href="${esc(unsubscribeUrl)}" style="color:#aaa;">Não quero receber promoções</a>.</p>
  `, storeName);
  await sendMail({ from: `"${storeName}" <${process.env.SMTP_USER}>`, to, subject: `${offer.headline} — ${offer.product.name}`, html });
}

export async function sendShippingEmail({
  to, customerName, orderNumber, storeName, trackingCode, shippingProofUrl,
}: {
  to: string; customerName: string; orderNumber: string; storeName: string;
  trackingCode?: string; shippingProofUrl?: string;
}) {
  if (!process.env.SMTP_USER) return;

  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 8px;">Seu pedido foi enviado!</h2>
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${esc(customerName)}</strong>! Seu pedido foi despachado.</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:16px 24px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Pedido</p>
      <p style="margin:0 0 12px;font-weight:700;font-size:18px;color:#be185d;">${orderNumber}</p>
      ${trackingCode ? `
        <p style="margin:0 0 4px;font-size:12px;color:#888;">Código de rastreio</p>
        <p style="margin:0;font-weight:700;font-size:22px;color:#111;letter-spacing:2px;">${esc(trackingCode)}</p>
        <a href="https://www.correios.com.br/rastreamento/#/home" style="display:inline-block;margin-top:10px;font-size:12px;color:#ec4899;">Rastrear nos Correios →</a>
      ` : ""}
    </div>

    ${shippingProofUrl ? `<p style="font-size:13px;color:#555;margin:0;">O comprovante de despacho está em anexo neste e-mail.</p>` : ""}
  `, storeName);

  type Attachment = { filename: string; path?: string; href?: string };
  let attachment: Attachment | undefined;
  if (shippingProofUrl) {
    if (shippingProofUrl.startsWith("http")) {
      attachment = { filename: "comprovante-despacho.pdf", href: shippingProofUrl };
    } else {
      attachment = { filename: "comprovante-despacho.pdf", path: path.join(process.cwd(), "public", shippingProofUrl.replace(/^\//, "")) };
    }
  }

  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `Pedido ${orderNumber} enviado${trackingCode ? ` — Rastreio: ${trackingCode}` : ""} — ${storeName}`,
    html,
    attachments: attachment ? [attachment] : [],
  });
}

export async function sendWaitlistNotificationEmail({
  to, customerName, productName, productSlug, size, color, storeName,
}: {
  to: string; customerName?: string | null; productName: string; productSlug: string;
  size?: string; color?: string; storeName: string;
}) {
  if (!process.env.SMTP_USER) return;

  const variantLabel = [size, color].filter(Boolean).join(" / ");
  const productUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/produtos/${productSlug}`;

  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 8px;">Produto disponível!</h2>
    <p style="color:#555;margin:0 0 20px;">
      ${customerName ? `Olá, <strong>${esc(customerName)}</strong>! ` : ""}
      O produto que você estava aguardando voltou ao estoque.
    </p>

    <div style="background:#fdf2f8;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Produto</p>
      <p style="margin:0;font-weight:700;font-size:18px;color:#be185d;">${esc(productName)}</p>
      ${variantLabel ? `<p style="margin:6px 0 0;font-size:13px;color:#555;">Variação: <strong>${esc(variantLabel)}</strong></p>` : ""}
    </div>

    <div style="text-align:center;margin-top:20px;">
      <a href="${productUrl}"
         style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:15px;">
        Ver produto →
      </a>
    </div>
  `, storeName);

  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `${productName}${variantLabel ? ` (${variantLabel})` : ""} está disponível — ${storeName}`,
    html,
  });
}

export async function sendOrderStatusEmail({
  to, customerName, orderNumber, newStatus, storeName, cancelReason,
}: {
  to: string; customerName: string; orderNumber: string; newStatus: string; storeName: string; cancelReason?: string;
}) {
  if (!process.env.SMTP_USER) return;

  const statusLabel = STATUS_PT[newStatus] || newStatus;

  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 8px;">Atualização do pedido</h2>
    <p style="color:#555;margin:0 0 24px;">Olá, <strong>${esc(customerName)}</strong>! Há uma novidade no seu pedido.</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:20px 24px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#888;">Pedido</p>
      <p style="margin:0 0 12px;font-weight:700;font-size:18px;color:#be185d;">${orderNumber}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#888;">Status atual</p>
      <p style="margin:0;font-weight:700;font-size:20px;color:#111;">${statusLabel}</p>
    </div>

    ${cancelReason ? `<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;color:#991b1b;font-size:13px;margin:0;"><strong>Motivo do cancelamento:</strong> ${esc(cancelReason)}</p>` : ""}
  `, storeName);

  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `Atualização do seu pedido ${orderNumber} — ${statusLabel}`,
    html,
  });
}

export async function sendNewOrderNotificationEmail({
  to, orderNumber, customerName, customerEmail, customerPhone, storeName, items, total,
}: {
  to: string; orderNumber: string; customerName: string; customerEmail?: string | null; customerPhone: string; storeName: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
}) {
  if (!process.env.SMTP_USER) return;

  const itemsHtml = items
    .map((i) => `<tr><td style="padding:6px 0;color:#444;">${esc(i.name)}</td><td style="padding:6px 0;color:#888;text-align:center;">${i.quantity}×</td><td style="padding:6px 0;font-weight:600;color:#111;text-align:right;">R$ ${(i.price * i.quantity).toFixed(2).replace(".", ",")}</td></tr>`)
    .join("");

  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 4px;">🎉 Novo pedido recebido!</h2>
    <p style="color:#555;margin:0 0 20px;">Um cliente acaba de finalizar uma compra com pagamento confirmado.</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Número do pedido</p>
      <p style="margin:0;font-weight:700;font-size:20px;color:#be185d;">${orderNumber}</p>
    </div>

    <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;">
      <p style="margin:0 0 8px;"><strong>👤 Cliente:</strong> ${esc(customerName)}</p>
      ${customerEmail ? `<p style="margin:0 0 8px;"><strong>📧 Email:</strong> ${esc(customerEmail)}</p>` : ""}
      <p style="margin:0;"><strong>📱 Telefone:</strong> ${esc(customerPhone)}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">${itemsHtml}</table>
    <div style="border-top:1px solid #f0f0f0;padding-top:10px;text-align:right;">
      <span style="font-size:16px;font-weight:700;color:#111;">Total: R$ ${total.toFixed(2).replace(".", ",")}</span>
    </div>

    <div style="margin-top:20px;background:#ecfdf5;border:1px solid #d1fae5;border-radius:8px;padding:12px 16px;color:#065f46;font-size:13px;">
      ✅ <strong>Pagamento confirmado.</strong> Pedido pronto para processamento.
    </div>
  `, storeName);

  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `🎉 Novo pedido ${orderNumber} — Pagamento confirmado`,
    html,
  });
}

export async function sendShippingConfirmationEmail({
  to, customerName, orderNumber, storeName, trackingCode, trackingUrl,
}: {
  to: string; customerName: string; orderNumber: string; storeName: string;
  trackingCode: string; trackingUrl: string;
}) {
  if (!process.env.SMTP_USER) return;

  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 8px;">Seu pedido foi enviado! 📦</h2>
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${esc(customerName)}</strong>! Seu pedido foi postado e já pode ser rastreado em tempo real.</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:20px 24px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#888;text-transform:uppercase;">Código de Rastreamento</p>
      <p style="margin:0 0 12px;font-weight:700;font-size:24px;color:#be185d;letter-spacing:1px;font-family:monospace;">${esc(trackingCode)}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;">Pedido</p>
      <p style="margin:0;font-weight:700;font-size:18px;color:#111;">${orderNumber}</p>
    </div>

    <div style="margin-bottom:20px;">
      <a href="${trackingUrl}" target="_blank"
         style="display:block;background:#ec4899;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;font-size:15px;text-align:center;">
        🔍 Rastrear Agora →
      </a>
    </div>

    <div style="background:#f9fafb;border-radius:8px;padding:14px 16px;font-size:13px;color:#555;">
      <p style="margin:0 0 8px;"><strong>⏱️ Dicas:</strong></p>
      <ul style="margin:0;padding-left:20px;color:#666;">
        <li>Você receberá atualizações automáticas do rastreamento por email</li>
        <li>O frete saiu via Melhor Envio e pode ser rastreado em tempo real</li>
        <li>Verifique a abas "Meus Pedidos" no site para mais detalhes</li>
      </ul>
    </div>
  `, storeName);

  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `📦 Seu pedido ${orderNumber} foi postado — Rastreio: ${trackingCode}`,
    html,
  });
}

export async function sendReturnRequestNotificationEmail({
  to, customerName, customerEmail, orderNumber, reason, storeName,
}: {
  to: string; customerName: string; customerEmail?: string | null; orderNumber: string; reason: string; storeName: string;
}) {
  if (!process.env.SMTP_USER) return;

  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 4px;">📦 Nova solicitação de devolução</h2>
    <p style="color:#555;margin:0 0 20px;">Um cliente acaba de solicitar devolução de um pedido.</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Número do pedido</p>
      <p style="margin:0;font-weight:700;font-size:20px;color:#be185d;">${orderNumber}</p>
    </div>

    <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;">
      <p style="margin:0 0 8px;"><strong>👤 Cliente:</strong> ${esc(customerName)}</p>
      ${customerEmail ? `<p style="margin:0 0 8px;"><strong>📧 Email:</strong> ${esc(customerEmail)}</p>` : ""}
    </div>

    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;margin-bottom:20px;color:#856404;font-size:13px;">
      <p style="margin:0 0 4px;"><strong>📝 Motivo da devolução:</strong></p>
      <p style="margin:0;">${esc(reason)}</p>
    </div>

    <div style="margin-top:20px;background:#e7f3ff;border:1px solid #b3d9ff;border-radius:8px;padding:12px 16px;color:#004085;font-size:13px;">
      ℹ️ <strong>Ação necessária:</strong> Acesse o painel admin para análise e resposta ao cliente.
    </div>
  `, storeName);

  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `📦 Nova solicitação de devolução — Pedido ${orderNumber}`,
    html,
  });
}

export async function sendReturnRequestConfirmationEmail({
  to, customerName, orderNumber, storeName,
}: {
  to: string; customerName: string; orderNumber: string; storeName: string;
}) {
  if (!process.env.SMTP_USER) return;

  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 8px;">Sua solicitação foi recebida! ✅</h2>
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${esc(customerName)}</strong>! Recebemos sua solicitação de devolução e estamos analisando.</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:16px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Pedido</p>
      <p style="margin:0;font-weight:700;font-size:20px;color:#be185d;">${orderNumber}</p>
    </div>

    <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:12px 16px;margin-bottom:20px;color:#065f46;font-size:13px;">
      ✅ <strong>Status:</strong> Sua solicitação está sendo analisada pela nossa equipe. Você receberá um email em breve com o código para postar a mercadoria.
    </div>

    <p style="color:#666;font-size:13px;margin:0;">Tempo estimado de resposta: até 3 dias úteis.</p>
  `, storeName);

  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `Sua solicitação de devolução foi recebida — Pedido ${orderNumber}`,
    html,
  });
}

export async function sendReturnLabelEmail({
  to, customerName, orderNumber, trackingCode, trackingUrl, storeName,
}: {
  to: string; customerName: string; orderNumber: string; trackingCode: string; trackingUrl: string; storeName: string;
}) {
  if (!process.env.SMTP_USER) return;

  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 8px;">Sua devolução foi autorizada para postagem 📦</h2>
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${esc(customerName)}</strong>! Geramos a etiqueta de devolução do seu pedido. Use o código abaixo para postar a mercadoria.</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:16px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Pedido</p>
      <p style="margin:0 0 12px;font-weight:700;font-size:20px;color:#be185d;">${orderNumber}</p>
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Código de postagem</p>
      <p style="margin:0;font-weight:700;font-size:22px;letter-spacing:1px;color:#111;">${esc(trackingCode)}</p>
    </div>

    <div style="background:#e7f3ff;border:1px solid #b3d9ff;border-radius:8px;padding:12px 16px;color:#004085;font-size:13px;margin-bottom:20px;">
      📬 <strong>Como postar:</strong> embale o(s) produto(s) com cuidado e leve até uma agência informando o código acima.
      Após recebermos e analisarmos a mercadoria, você receberá um email com a resposta da devolução.
    </div>

    <div style="text-align:center;margin-bottom:20px;">
      <a href="${trackingUrl}" style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">Acompanhar postagem</a>
    </div>
  `, storeName);

  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `Código de postagem da sua devolução — Pedido ${orderNumber}`,
    html,
  });
}

export async function sendReturnDecisionEmail({
  to, customerName, orderNumber, approved, storeName, adminNotes, images, refundAmount,
}: {
  to: string; customerName: string; orderNumber: string; approved: boolean; storeName: string; adminNotes?: string; images?: Array<{ url: string }>; refundAmount?: number;
}) {
  if (!process.env.SMTP_USER) return;

  const statusLabel = approved ? "✅ APROVADA" : "❌ RECUSADA";
  const statusColor = approved ? "#065f46" : "#991b1b";
  const statusBg = approved ? "#d1fae5" : "#fee2e2";
  const statusBorder = approved ? "#6ee7b7" : "#fecaca";

  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 8px;">Sua devolução foi ${approved ? "aprovada" : "analisada"}!</h2>
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${esc(customerName)}</strong>! Finalizamos a análise da sua solicitação de devolução.</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:16px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Pedido</p>
      <p style="margin:0;font-weight:700;font-size:20px;color:#be185d;">${orderNumber}</p>
    </div>

    <div style="background:${statusBg};border:1px solid ${statusBorder};border-radius:8px;padding:16px;margin-bottom:20px;color:${statusColor};font-size:14px;">
      <p style="margin:0 0 8px;font-weight:700;font-size:16px;">${statusLabel}</p>
      ${adminNotes ? `<p style="margin:0;">${esc(adminNotes)}</p>` : ""}
    </div>

    ${approved ? `
      <div style="background:#e7f3ff;border:1px solid #b3d9ff;border-radius:8px;padding:12px 16px;color:#004085;font-size:13px;margin-bottom:20px;">
        💰 <strong>Estorno:</strong> ${refundAmount && refundAmount > 0 ? `o valor de <strong>R$ ${refundAmount.toFixed(2).replace(".", ",")}</strong> será estornado` : "o estorno será processado"} pela mesma forma de pagamento utilizada na compra. O prazo para aparecer depende da sua instituição financeira.
      </div>
    ` : `
      <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;color:#856404;font-size:13px;margin-bottom:20px;">
        ℹ️ Se tiver dúvidas, entre em contato com nossa equipe de atendimento.
      </div>
    `}
  `, storeName);

  const mailOptions: any = {
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `Sua devolução foi ${approved ? "aprovada" : "analisada"} — Pedido ${orderNumber}`,
    html,
  };

  if (images && images.length > 0) {
    mailOptions.attachments = images.map((img: any, idx: number) => ({
      filename: `imagem-produto-${idx + 1}.jpg`,
      path: img.url,
    }));
  }

  await sendMail(mailOptions);
}

export async function sendEmailStatusChanged({
  to,
  customerName,
  orderNumber,
  newStatus,
  message,
  storeName,
}: {
  to: string;
  customerName: string;
  orderNumber: string;
  newStatus: string;
  message: string;
  storeName: string;
}) {
  if (!process.env.SMTP_USER) return;

  let emoji = "📦";
  let statusLabel = "Atualização de Entrega";
  let statusColor = "#3b82f6";

  if (newStatus === "in_transit") {
    emoji = "🚚";
    statusLabel = "Seu pacote está em trânsito!";
    statusColor = "#f59e0b";
  } else if (newStatus === "delivered") {
    emoji = "✅";
    statusLabel = "Seu pacote foi entregue!";
    statusColor = "#10b981";
  }

  const html = baseWrapper(`
    <h2 style="color:${statusColor};margin:0 0 8px;">${emoji} ${statusLabel}</h2>
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${esc(customerName)}</strong>!</p>

    <div style="background:#f3f4f6;border-radius:10px;padding:16px 20px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Pedido</p>
      <p style="margin:0;font-weight:700;font-size:20px;color:#1f2937;">${orderNumber}</p>
    </div>

    <div style="background:#f0f9ff;border-left:4px solid ${statusColor};border-radius:4px;padding:16px;margin-bottom:20px;color:#1e3a8a;font-size:15px;">
      <p style="margin:0;">${esc(message)}</p>
    </div>

    ${newStatus === "in_transit" ? `
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;color:#92400e;font-size:13px;margin-bottom:20px;">
        🔗 <strong>Rastrear pacote:</strong> Você pode acompanhar seu pedido em tempo real através do código de rastreamento.
      </div>
    ` : newStatus === "delivered" ? `
      <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:12px 16px;color:#065f46;font-size:13px;margin-bottom:20px;">
        ✨ Obrigado por comprar conosco! Se tiver qualquer dúvida sobre o produto, nossa equipe está à disposição.
      </div>
    ` : ""}
  `, storeName);

  await sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `${emoji} ${statusLabel} - Pedido ${orderNumber}`,
    html,
  });
}
