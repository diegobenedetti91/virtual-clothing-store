import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/utils";
import { normalizeVariantStock, matchesSelection } from "@/lib/variantUtils";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerName, customerEmail, customerPhone, address, city, state, zipCode, notes, customerId, items } = body;

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

  const subtotal = mpItems.reduce((s: number, i: { unit_price: number; quantity: number }) => s + i.unit_price * i.quantity, 0);
  const orderNumber = generateOrderNumber();

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const preference = {
    external_reference: orderNumber,
    items: mpItems,
    payer: {
      name: customerName,
      email: customerEmail || undefined,
      phone: { number: customerPhone },
    },
    back_urls: {
      success: `${baseUrl}/checkout/sucesso?order=${orderNumber}`,
      failure: `${baseUrl}/checkout/falha?order=${orderNumber}`,
      pending: `${baseUrl}/checkout/pendente?order=${orderNumber}`,
    },
    auto_return: "approved",
    notification_url: `${baseUrl}/api/checkout/mercadopago/webhook`,
    metadata: { orderNumber },
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

  // Create order in our DB with PENDING status + decrement variant stock
  type CartItem = {
    productId: string;
    quantity: number;
    price?: number;
    size?: string;
    color?: string;
    selectedAttributes?: Record<string, string>;
  };
  const fullAddress = address && city ? `${address}, ${city}${state ? `/${state}` : ""}` : null;
  await prisma.$transaction(async (tx) => {
    for (const item of items as CartItem[]) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { variantStock: true },
      });
      const raw = JSON.parse(product?.variantStock || "[]");
      const variants = normalizeVariantStock(raw);

      const selected: Record<string, string> = item.selectedAttributes
        ? item.selectedAttributes
        : {
            ...(item.size ? { Tamanho: item.size } : {}),
            ...(item.color ? { Cor: item.color } : {}),
          };

      const hasSelection = Object.keys(selected).length > 0;

      if (variants.length > 0 && hasSelection) {
        const updated = variants.map((v) =>
          matchesSelection(v.attributes, selected)
            ? { ...v, stock: Math.max(0, v.stock - item.quantity) }
            : v
        );
        const newTotal = updated.reduce((sum, v) => sum + (v.stock || 0), 0);
        await tx.product.update({
          where: { id: item.productId },
          data: { variantStock: JSON.stringify(updated), stock: newTotal },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    }

    await tx.order.create({
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
  });

  return NextResponse.json({
    initPoint: mpData.init_point,
    sandboxInitPoint: mpData.sandbox_init_point,
    orderNumber,
  });
}
