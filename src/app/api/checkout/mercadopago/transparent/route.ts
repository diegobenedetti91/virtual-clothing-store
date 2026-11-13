import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateCheckout } from "@/lib/checkoutValidation";
import { getMetaOrderContext } from "@/lib/metaCapi";
import { getTrafficOrderContext } from "@/lib/trafficSourceServer";
import { generateOrderNumber } from "@/lib/utils";
import { isRateLimited, clientIp } from "@/lib/rateLimit";
import { MP_TRANSPARENT_LABEL, PIX_EXPIRATION_MINUTES, mpDate, rejectionMessage } from "@/lib/mercadoPagoTransparent";

// Transparent checkout: the Payment Brick (card or Pix form inside the store)
// sends its formData here. We price the order on the server, create the order
// (PENDING) and the payment on Mercado Pago. Confirmation, stock, Bling,
// shipping, e-mails and Meta Purchase keep running in the existing MP webhook.

const round2 = (n: number) => Math.round(n * 100) / 100;

interface BrickFormData {
  token?: string;
  issuer_id?: string | number;
  payment_method_id?: string;
  installments?: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
}

export async function POST(req: NextRequest) {
  if (isRateLimited(`mp-transparent:${clientIp(req.headers)}`, 15, 10 * 60 * 1000)) {
    return NextResponse.json({ status: "error", message: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ status: "error", message: "Requisição inválida" }, { status: 400 });

  const {
    customerName, customerEmail, customerPhone, address, streetNumber, neighborhood, city, state, zipCode, cpfCnpj, notes,
    items: rawItems, shippingMethod, pixOnly = false, couponCode,
  } = body;
  const formData: BrickFormData = body.formData && typeof body.formData === "object" ? body.formData : {};

  if (!customerName || !customerPhone) {
    return NextResponse.json({ status: "error", message: "Dados incompletos" }, { status: 400 });
  }

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const accessToken = settings?.mercadoPagoAccessToken;
  if (!settings?.mercadoPagoAtivo || !settings.mercadoPagoTransparente || !accessToken) {
    return NextResponse.json({ status: "error", message: "Pagamento no site indisponível" }, { status: 400 });
  }

  const checked = await validateCheckout(req, {
    items: rawItems, zipCode, shippingMethod, pixOnly: pixOnly === true, couponCode,
    customerEmail: customerEmail || body.formData?.payer?.email, cpfCnpj: cpfCnpj || body.formData?.payer?.identification?.number,
  });
  if ("error" in checked) return NextResponse.json({ status: "error", message: checked.error }, { status: 400 });
  const { items, productMap, subtotal, shippingCost, discountAmount, customerId } = checked;
  const total = round2(subtotal + shippingCost - discountAmount);

  // ---- payment method
  const isPix = formData.payment_method_id === "pix";
  if (pixOnly === true && !isPix) {
    return NextResponse.json({ status: "error", message: "O desconto Pix vale apenas para pagamento com Pix." }, { status: 400 });
  }
  const installments = Number(formData.installments ?? 1);
  if (!isPix) {
    if (typeof formData.token !== "string" || !formData.token || typeof formData.payment_method_id !== "string") {
      return NextResponse.json({ status: "error", message: "Dados do cartão incompletos" }, { status: 400 });
    }
    if (!Number.isInteger(installments) || installments < 1 || installments > 24) {
      return NextResponse.json({ status: "error", message: "Número de parcelas inválido" }, { status: 400 });
    }
  }

  // ---- payer
  const email = String(formData.payer?.email || customerEmail || "").trim();
  if (!email) return NextResponse.json({ status: "error", message: "E-mail é obrigatório para o pagamento" }, { status: 400 });
  const docDigits = String(formData.payer?.identification?.number || cpfCnpj || "").replace(/\D/g, "");
  const identification = docDigits
    ? { type: formData.payer?.identification?.type || (docDigits.length > 11 ? "CNPJ" : "CPF"), number: docDigits }
    : undefined;
  const nameParts = String(customerName).trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ") || undefined;
  const phoneClean = String(customerPhone).replace(/\D/g, "");
  const phone = phoneClean.length >= 10 ? { area_code: phoneClean.slice(0, 2), number: phoneClean.slice(2) } : undefined;

  // ---- order (PENDING) — same shape as the redirect checkout
  const orderNumber = generateOrderNumber();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const fullAddress = address && city ? `${address}, ${city}${state ? `/${state}` : ""}` : null;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerName,
      customerEmail: customerEmail || email || null,
      customerPhone,
      address: fullAddress,
      streetNumber: streetNumber || null,
      neighborhood: neighborhood || null,
      city: city || null,
      state: state || null,
      zipCode: zipCode || null,
      cpfCnpj: cpfCnpj || null,
      notes: notes || null,
      customerId,
      subtotal,
      shippingCost,
      shippingMethod: shippingMethod || null,
      total,
      couponCode: checked.coupon?.code ?? null,
      couponDiscount: checked.couponDiscount,
      status: "PENDING",
      paymentGateway: "mercadopago",
      paymentMethod: MP_TRANSPARENT_LABEL,
      ...getMetaOrderContext(req),
      ...getTrafficOrderContext(req),
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: productMap.get(item.productId)!.price,
          size: item.size || null,
          color: item.color || null,
          selectedAttributes: item.selectedAttributes ? JSON.stringify(item.selectedAttributes) : null,
        })),
      },
    },
  });

  // A refused/failed attempt leaves nothing behind: no money moved, no stock taken.
  const discardOrder = () =>
    prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { orderId: order.id } }),
      prisma.order.delete({ where: { id: order.id } }),
    ]).catch((err) => console.error("[MP TRANSPARENT] Failed to discard order:", err));

  // ---- payment
  const payment: Record<string, unknown> = {
    transaction_amount: total,
    description: `Pedido ${orderNumber} - ${settings.name || "Loja"}`,
    external_reference: orderNumber,
    notification_url: `${baseUrl}/api/checkout/mercadopago/webhook`,
    payer: { email, first_name: firstName, last_name: lastName, ...(identification ? { identification } : {}) },
    additional_info: {
      items: items.map((i) => {
        const p = productMap.get(i.productId)!;
        return { id: p.id, title: p.name, quantity: i.quantity, unit_price: p.price };
      }),
      payer: {
        first_name: firstName,
        last_name: lastName,
        ...(phone ? { phone } : {}),
        ...(zipCode ? { address: { zip_code: String(zipCode).replace(/\D/g, ""), street_name: address || undefined, street_number: streetNumber || undefined } } : {}),
      },
      ...(zipCode
        ? { shipments: { receiver_address: { zip_code: String(zipCode).replace(/\D/g, ""), street_name: address || undefined, street_number: streetNumber || undefined, city_name: city || undefined, state_name: state || undefined } } }
        : {}),
    },
    metadata: { order_number: orderNumber },
  };
  if (isPix) {
    payment.payment_method_id = "pix";
    payment.date_of_expiration = mpDate(new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000));
  } else {
    payment.token = formData.token;
    payment.payment_method_id = formData.payment_method_id;
    payment.installments = installments;
    if (formData.issuer_id) payment.issuer_id = Number(formData.issuer_id);
  }

  let mp: Record<string, unknown>;
  try {
    const res = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": `${orderNumber}-${randomUUID()}`,
      },
      body: JSON.stringify(payment),
      signal: AbortSignal.timeout(20000),
    });
    mp = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[MP TRANSPARENT] Payment API error:", res.status, mp?.message, mp?.cause);
      await discardOrder();
      return NextResponse.json(
        { status: "rejected", message: "Não foi possível processar o pagamento. Confira os dados ou use outra forma de pagamento." },
        { status: 200 }
      );
    }
  } catch (err) {
    console.error("[MP TRANSPARENT] Payment request failed:", err);
    await discardOrder();
    return NextResponse.json({ status: "error", message: "Falha de comunicação com o Mercado Pago. Tente novamente." }, { status: 502 });
  }

  const status = String(mp.status || "");
  const statusDetail = String(mp.status_detail || "");
  const paymentId = mp.id ? String(mp.id) : null;

  if (status === "rejected" || status === "cancelled" || !paymentId) {
    await discardOrder();
    return NextResponse.json({ status: "rejected", message: rejectionMessage(statusDetail) });
  }

  // Keep the payment id now, so refunds work even before the webhook arrives
  await prisma.order.update({ where: { id: order.id }, data: { paymentId } }).catch(console.error);

  if (isPix) {
    const tx = (mp.point_of_interaction as { transaction_data?: Record<string, string> } | undefined)?.transaction_data;
    if (!tx?.qr_code) {
      console.error("[MP TRANSPARENT] Pix without QR code", { paymentId, status });
      return NextResponse.json({ status: "error", message: "Não foi possível gerar o Pix. Tente novamente." }, { status: 502 });
    }
    return NextResponse.json({
      status: "pix",
      orderNumber,
      pix: {
        qrCode: tx.qr_code,
        qrCodeBase64: tx.qr_code_base64,
        ticketUrl: tx.ticket_url,
        expiresAt: mp.date_of_expiration || null,
        amount: total,
      },
    });
  }

  if (status === "approved") return NextResponse.json({ status: "approved", orderNumber });
  // in_process / pending (card under review)
  return NextResponse.json({ status: "in_process", orderNumber });
}
