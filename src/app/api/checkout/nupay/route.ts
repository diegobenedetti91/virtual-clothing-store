import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/utils";

// NuPay for Business API base URL
// Confirm the exact URL in your NuPay for Business dashboard after credentialing
const NUPAY_API_URL = "https://api.nupaybusiness.com.br";

async function getNuPayToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${NUPAY_API_URL}/auth/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NuPay auth error: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerName, customerEmail, customerPhone, address, city, state, zipCode, notes, customerId, items } = body;

  if (!customerName || !customerPhone || !items?.length) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const clientId = settings?.nuPayClientId;
  const clientSecret = settings?.nuPayClientSecret;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "NuPay não configurado" }, { status: 400 });
  }

  // Fetch product prices from DB (never trust client-side price)
  const productIds = items.map((i: { productId: string }) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  type CartItem = {
    productId: string;
    quantity: number;
    price?: number;
    size?: string;
    color?: string;
    selectedAttributes?: Record<string, string>;
  };

  const orderItems = items.map((item: CartItem) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Produto não encontrado: ${item.productId}`);
    return {
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
    };
  });

  const subtotal = orderItems.reduce(
    (s: number, i: { unitPrice: number; quantity: number }) => s + i.unitPrice * i.quantity,
    0
  );
  const orderNumber = generateOrderNumber();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  let token: string;
  try {
    token = await getNuPayToken(clientId, clientSecret);
  } catch (err) {
    console.error("NuPay auth error:", err);
    return NextResponse.json({ error: "Erro ao autenticar com NuPay" }, { status: 500 });
  }

  const orderPayload = {
    externalReference: orderNumber,
    amount: Math.round(subtotal * 100), // NuPay expects value in cents
    currency: "BRL",
    description: `Pedido ${orderNumber} - ${settings?.name || "Minha Loja"}`,
    customer: {
      name: customerName,
      email: customerEmail || undefined,
      phone: customerPhone,
    },
    items: orderItems.map((i: { productId: string; name: string; quantity: number; unitPrice: number }) => ({
      id: i.productId,
      title: i.name,
      quantity: i.quantity,
      unitPrice: Math.round(i.unitPrice * 100),
    })),
    returnUrl: `${baseUrl}/checkout/sucesso?order=${orderNumber}`,
    cancelUrl: `${baseUrl}/checkout/falha?order=${orderNumber}`,
    notificationUrl: `${baseUrl}/api/checkout/nupay/webhook`,
  };

  const nuPayRes = await fetch(`${NUPAY_API_URL}/v1/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(orderPayload),
  });

  if (!nuPayRes.ok) {
    const err = await nuPayRes.text();
    console.error("NuPay order error:", err);
    return NextResponse.json({ error: "Erro ao criar pedido NuPay" }, { status: 500 });
  }

  const nuPayData = await nuPayRes.json();
  const paymentUrl: string = nuPayData.paymentUrl ?? nuPayData.payment_url ?? nuPayData.checkoutUrl;

  if (!paymentUrl) {
    console.error("NuPay response missing paymentUrl:", nuPayData);
    return NextResponse.json({ error: "NuPay não retornou URL de pagamento" }, { status: 500 });
  }

  // Create order with PENDING status immediately
  const fullAddress = address && city ? `${address}, ${city}${state ? `/${state}` : ""}` : null;

  await prisma.order.create({
    data: {
      orderNumber,
      customerName,
      customerEmail: customerEmail || null,
      customerPhone,
      address: fullAddress,
      city: city || null,
      state: state || null,
      zipCode: zipCode || null,
      notes: notes || null,
      customerId: customerId || null,
      subtotal,
      total: subtotal,
      status: "PENDING",
      items: {
        create: (items as CartItem[]).map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: productMap.get(item.productId)!.price,
          size: item.size || null,
          color: item.color || null,
          selectedAttributes: item.selectedAttributes
            ? JSON.stringify(item.selectedAttributes)
            : null,
        })),
      },
    },
  });

  return NextResponse.json({ paymentUrl, orderNumber });
}
