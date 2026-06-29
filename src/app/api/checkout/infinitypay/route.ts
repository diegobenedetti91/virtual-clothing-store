import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerName, customerEmail, customerPhone, address, city, state, zipCode, notes, customerId, items, shippingCost, shippingMethod, discountAmount = 0, pixOnly = false } = body;

  if (!customerName || !customerPhone || !items?.length) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const handle = settings?.infinityPayHandle;
  const apiKey = settings?.infinityPayApiKey;

  if (!handle || !apiKey) {
    return NextResponse.json({ error: "Infinity Pay não configurado" }, { status: 400 });
  }

  // Fetch product prices from DB (never trust client-side price)
  const productIds = items.map((i: { productId: string }) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const ipItems = items.map((item: { productId: string; quantity: number; size?: string; color?: string }) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Produto não encontrado: ${item.productId}`);
    return {
      price: Math.round(product.price * 100),
      quantity: item.quantity,
      description: `${product.name}${item.size ? ` (${item.size})` : ""}${item.color ? ` - ${item.color}` : ""}`,
    };
  });

  const subtotal = items.reduce((s: number, i: { productId: string; quantity: number }) => {
    const product = productMap.get(i.productId);
    return s + (product?.price || 0) * i.quantity;
  }, 0);

  const total = subtotal + (shippingCost || 0) - (discountAmount || 0);
  const orderNumber = generateOrderNumber();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  // Adicionar frete como item se houver
  if (shippingCost && shippingCost > 0) {
    const shippingWithDiscount = Math.max(0, shippingCost - (discountAmount || 0));
    ipItems.push({
      price: Math.round(shippingWithDiscount * 100),
      quantity: 1,
      description: `Frete${shippingMethod ? ` (${shippingMethod})` : ""}`,
    });
  }

  const payload = {
    handle,
    items: ipItems,
    order_nsu: orderNumber,
    redirect_url: `${baseUrl}/checkout/sucesso?order=${orderNumber}`,
    webhook_url: `${baseUrl}/api/checkout/infinitypay/webhook`,
    ...(customerName || customerEmail || customerPhone ? {
      customer: {
        ...(customerName && { name: customerName }),
        ...(customerEmail && { email: customerEmail }),
        ...(customerPhone && { phone_number: customerPhone.replace(/\D/g, "") }),
      },
    } : {}),
    ...(address || zipCode ? {
      address: {
        ...(zipCode && { cep: zipCode.replace(/\D/g, "") }),
      },
    } : {}),
  };

  try {
    const ipRes = await fetch("https://api.checkout.infinitypay.io/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!ipRes.ok) {
      const err = await ipRes.text();
      console.error("Infinity Pay error:", ipRes.status, err);
      console.error("Payload sent:", JSON.stringify(payload, null, 2));
      return NextResponse.json({ error: "Erro ao criar link de pagamento Infinity Pay" }, { status: 500 });
    }

    const ipData = await ipRes.json();
    const paymentUrl = ipData.url;

    if (!paymentUrl) {
      console.error("Infinity Pay response missing payment URL:", ipData);
      return NextResponse.json({ error: "Infinity Pay não retornou URL de pagamento" }, { status: 500 });
    }

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
        paymentMethod: "Infinity Pay",
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
      paymentUrl,
      orderNumber,
      transactionId: ipData.transaction_nsu || ipData.id,
    });
  } catch (error) {
    console.error("Infinity Pay integration error:", error);
    return NextResponse.json({ error: "Erro ao processar pagamento" }, { status: 500 });
  }
}
