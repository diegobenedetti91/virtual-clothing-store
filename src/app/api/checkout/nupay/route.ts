import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTrafficOrderContext } from "@/lib/trafficSourceServer";
import { orderDiscountFields, validateCheckout } from "@/lib/checkoutValidation";
import { getClientIp, getMetaOrderContext } from "@/lib/metaCapi";
import { generateOrderNumber } from "@/lib/utils";
import { createNuPayPayment, getNuPayConfig } from "@/lib/nupay";

// NuPay for Business (official checkout API): creates the order (PENDING) and a
// NuPay payment; the buyer approves it in the Nubank app via `paymentUrl`.
// Confirmation comes through /api/checkout/nupay/webhook, which re-checks the
// status on NuPay before updating the order.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  const {
    customerName, customerEmail, customerPhone, address, streetNumber, neighborhood, city, state, zipCode, cpfCnpj, notes,
    items: rawItems, shippingMethod, couponCode,
  } = body;

  if (!customerName || !customerPhone) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const config = await getNuPayConfig();
  if (!settings?.nuPayAtivo || !config) {
    return NextResponse.json({ error: "NuPay não configurado" }, { status: 400 });
  }

  // NuPay has no Pix: the Pix discount never applies here
  const checked = await validateCheckout(req, { items: rawItems, zipCode, shippingMethod, pixOnly: false, couponCode, useCredit: body?.useCredit === true, customerEmail, cpfCnpj });
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const { items, productMap, subtotal, shippingCost, discountAmount, customerId } = checked;
  const total = Math.round((subtotal + shippingCost - discountAmount) * 100) / 100;

  const orderNumber = generateOrderNumber();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const fullAddress = address && city ? `${address}, ${city}${state ? `/${state}` : ""}` : null;

  // Order first (PENDING), so the webhook always finds it
  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerName,
      customerEmail: customerEmail || null,
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
      ...orderDiscountFields(checked),
      status: "PENDING",
      paymentGateway: "nupay",
      paymentMethod: "NuPay",
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

  const nameParts = String(customerName).trim().split(/\s+/);
  const phoneDigits = String(customerPhone).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const document = String(cpfCnpj || "").replace(/\D/g, "");
  const cep = String(zipCode || "").replace(/\D/g, "");
  const nuAddress = cep
    ? {
        country: "BRA",
        street: address || undefined,
        number: streetNumber || undefined,
        neighborhood: neighborhood || undefined,
        postalCode: cep,
        city: city || undefined,
        state: state || undefined,
      }
    : undefined;

  const created = await createNuPayPayment(config, {
    merchantOrderReference: orderNumber,
    referenceId: orderNumber,
    merchantName: settings.name || undefined,
    amount: { value: total, currency: "BRL" },
    delayToAutoCancel: 30,
    paymentMethod: { type: "nupay" },
    paymentFlow: {
      returnUrl: `${baseUrl}/checkout/sucesso?order=${orderNumber}`,
      cancelUrl: `${baseUrl}/checkout/falha?order=${orderNumber}`,
    },
    // NuPay only accepts https callbacks (none in local http development)
    ...(baseUrl.startsWith("https://") ? { callbackUrl: `${baseUrl}/api/checkout/nupay/webhook` } : {}),
    shopper: {
      reference: customerId || customerEmail || orderNumber,
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" ") || nameParts[0],
      ...(document ? { document, documentType: document.length > 11 ? "CNPJ" : "CPF" } : {}),
      ...(customerEmail ? { email: customerEmail } : {}),
      ...(phoneDigits ? { phone: { country: "55", number: phoneDigits } } : {}),
      ...(getClientIp(req) ? { ip: getClientIp(req) } : {}),
      locale: "pt-BR",
    },
    items: items.map((i) => {
      const p = productMap.get(i.productId)!;
      return { id: p.id, description: p.name, value: p.price, quantity: i.quantity };
    }),
    ...(nuAddress ? { shipping: { value: shippingCost, address: nuAddress }, billingAddress: nuAddress } : {}),
  });

  if (!created) {
    // Nothing was charged: drop the order so it doesn't linger as pending
    await prisma
      .$transaction([prisma.orderItem.deleteMany({ where: { orderId: order.id } }), prisma.order.delete({ where: { id: order.id } })])
      .catch((err) => console.error("[NUPAY] Failed to discard order:", err));
    return NextResponse.json({ error: "Não foi possível iniciar o pagamento NuPay. Tente novamente." }, { status: 502 });
  }

  await prisma.order.update({ where: { id: order.id }, data: { paymentId: created.pspReferenceId } });

  // Stock is taken only when the payment is confirmed (webhook -> commitOrderStock)
  return NextResponse.json({ paymentUrl: created.paymentUrl, orderNumber });
}
