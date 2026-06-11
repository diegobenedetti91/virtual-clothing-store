import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerName, customerEmail, customerPhone, address, city, state, zipCode, notes, customerId, items, shippingCost, shippingMethod } = body;

  if (!customerName || !customerPhone || !items?.length) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const accessToken = settings?.mercadoPagoAccessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "Mercado Pago não configurado" }, { status: 400 });
  }

  // Fetch product prices from DB (never trust client-side price)
  const productIds = items.map((i: { productId: string }) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const mpItems = items.map((item: { productId: string; quantity: number; size?: string; color?: string }) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Produto não encontrado: ${item.productId}`);
    return {
      id: product.id,
      title: product.name,
      quantity: item.quantity,
      unit_price: product.price,
      currency_id: "BRL",
    };
  });

  // Calculate subtotal from products only (before adding shipping)
  const subtotal = mpItems.reduce((s: number, i: { unit_price: number; quantity: number }) => s + i.unit_price * i.quantity, 0);
  const total = subtotal + (shippingCost || 0);

  // Add shipping as a separate item to display in MP checkout
  if (shippingCost && shippingCost > 0) {
    mpItems.push({
      id: "frete",
      title: `Frete${shippingMethod ? ` (${shippingMethod})` : ""}`,
      quantity: 1,
      unit_price: shippingCost,
      currency_id: "BRL",
    });
  }
  const orderNumber = generateOrderNumber();

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  // Parse phone number for MP format (area_code + number)
  const phoneClean = customerPhone.replace(/\D/g, "");
  const areaCode = phoneClean.length >= 11 ? phoneClean.slice(0, 2) : "";
  const phoneNumber = phoneClean.length >= 11 ? phoneClean.slice(2) : phoneClean;

  const preference = {
    external_reference: orderNumber,
    items: mpItems,
    payer: {
      name: customerName,
      email: customerEmail || undefined,
      ...(areaCode && phoneNumber ? {
        phone: { area_code: areaCode, number: phoneNumber }
      } : {}),
    },
    back_urls: {
      success: `${baseUrl}/checkout/sucesso?order=${orderNumber}`,
      failure: `${baseUrl}/checkout/falha?order=${orderNumber}`,
      pending: `${baseUrl}/checkout/pendente?order=${orderNumber}`,
    },
    auto_return: "approved",
    notification_url: `${baseUrl}/api/checkout/mercadopago/webhook`,
    ...(address && city ? {
      shipments: {
        receiver_address: {
          zip_code: zipCode || "",
          street_name: address || "",
          street_number: "",
          city_name: city || "",
          state_name: state || "",
        },
      },
    } : {}),
    metadata: {
      orderNumber,
      customerName,
      customerEmail: customerEmail || "",
      customerPhone,
      address: address || "",
      city: city || "",
      state: state || "",
      zipCode: zipCode || "",
      notes: notes || "",
      customerId: customerId || "",
      items: JSON.stringify(items),
    },
  };

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(preference),
  });

  if (!mpRes.ok) {
    const err = await mpRes.text();
    console.error("MP preference error:", err);
    return NextResponse.json({ error: "Erro ao criar preferência MP" }, { status: 500 });
  }

  const mpData = await mpRes.json();

  // Create order with PENDING status immediately
  type CartItem = {
    productId: string;
    quantity: number;
    price?: number;
    size?: string;
    color?: string;
    selectedAttributes?: Record<string, string>;
  };
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
      shippingCost: shippingCost || 0,
      shippingMethod: shippingMethod || null,
      total,
      status: "PENDING",
      paymentMethod: "Mercado Pago",
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

  return NextResponse.json({
    initPoint: mpData.init_point,
    sandboxInitPoint: mpData.sandbox_init_point,
    orderNumber,
  });
}
