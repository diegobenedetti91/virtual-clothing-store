import nodemailer from "nodemailer";
import path from "path";

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
  await transporter.sendMail({
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
    .map((i) => `<tr><td style="padding:6px 0;color:#444;">${i.name}</td><td style="padding:6px 0;color:#888;text-align:center;">${i.quantity}×</td><td style="padding:6px 0;font-weight:600;color:#111;text-align:right;">R$ ${(i.price * i.quantity).toFixed(2).replace(".", ",")}</td></tr>`)
    .join("");

  const nextStep = isGateway
    ? `<p style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;color:#166534;font-size:13px;margin:0;">✅ <strong>Pagamento confirmado!</strong> Seu pedido foi recebido e está sendo preparado.</p>`
    : `<p style="background:#fef9c3;border:1px solid #fef08a;border-radius:8px;padding:12px 16px;color:#854d0e;font-size:13px;margin:0;">💬 <strong>Pedido recebido!</strong> Nossa equipe entrará em contato via WhatsApp em breve para confirmar pagamento e entrega.</p>`;

  const html = baseWrapper(`
    <h2 style="color:#ec4899;margin:0 0 4px;">Pedido realizado!</h2>
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${customerName}</strong>! Recebemos seu pedido com sucesso.</p>

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

  await transporter.sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `Pedido ${orderNumber} recebido — ${storeName}`,
    html,
  });
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
    <p style="color:#555;margin:0 0 20px;">Olá, <strong>${customerName}</strong>! Seu pedido foi despachado.</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:16px 24px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Pedido</p>
      <p style="margin:0 0 12px;font-weight:700;font-size:18px;color:#be185d;">${orderNumber}</p>
      ${trackingCode ? `
        <p style="margin:0 0 4px;font-size:12px;color:#888;">Código de rastreio</p>
        <p style="margin:0;font-weight:700;font-size:22px;color:#111;letter-spacing:2px;">${trackingCode}</p>
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

  await transporter.sendMail({
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
      ${customerName ? `Olá, <strong>${customerName}</strong>! ` : ""}
      O produto que você estava aguardando voltou ao estoque.
    </p>

    <div style="background:#fdf2f8;border-radius:10px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:12px;color:#888;">Produto</p>
      <p style="margin:0;font-weight:700;font-size:18px;color:#be185d;">${productName}</p>
      ${variantLabel ? `<p style="margin:6px 0 0;font-size:13px;color:#555;">Variação: <strong>${variantLabel}</strong></p>` : ""}
    </div>

    <div style="text-align:center;margin-top:20px;">
      <a href="${productUrl}"
         style="display:inline-block;background:#ec4899;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:15px;">
        Ver produto →
      </a>
    </div>
  `, storeName);

  await transporter.sendMail({
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
    <p style="color:#555;margin:0 0 24px;">Olá, <strong>${customerName}</strong>! Há uma novidade no seu pedido.</p>

    <div style="background:#fdf2f8;border-radius:10px;padding:20px 24px;margin-bottom:20px;text-align:center;">
      <p style="margin:0 0 4px;font-size:13px;color:#888;">Pedido</p>
      <p style="margin:0 0 12px;font-weight:700;font-size:18px;color:#be185d;">${orderNumber}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#888;">Status atual</p>
      <p style="margin:0;font-weight:700;font-size:20px;color:#111;">${statusLabel}</p>
    </div>

    ${cancelReason ? `<p style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;color:#991b1b;font-size:13px;margin:0;"><strong>Motivo do cancelamento:</strong> ${cancelReason}</p>` : ""}
  `, storeName);

  await transporter.sendMail({
    from: `"${storeName}" <${process.env.SMTP_USER}>`,
    to,
    subject: `Atualização do seu pedido ${orderNumber} — ${statusLabel}`,
    html,
  });
}
