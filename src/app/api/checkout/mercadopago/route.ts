import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateCheckout } from "@/lib/checkoutValidation";
import { getMetaOrderContext } from "@/lib/metaCapi";
import { generateOrderNumber } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerName, customerEmail, customerPhone, address, streetNumber, neighborhood, city, state, zipCode, cpfCnpj, notes, items: rawItems, shippingMethod, pixOnly = false } = body;

  if (!customerName || !customerPhone) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const checked = await validateCheckout(req, { items: rawItems, zipCode, shippingMethod, pixOnly });
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const { items, productMap, subtotal, shippingCost, discountAmount, customerId } = checked;

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const accessToken = settings?.mercadoPagoAccessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "Mercado Pago não configurado" }, { status: 400 });
  }


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

  const total = subtotal + shippingCost - discountAmount;

  // Add shipping as a separate item to display in MP checkout
  // Apply discount to shipping cost if available
  const shippingWithDiscount = Math.max(0, (shippingCost || 0) - (discountAmount || 0));
  if (shippingCost && shippingCost > 0) {
    mpItems.push({
      id: "frete",
      title: `Frete${shippingMethod ? ` (${shippingMethod})` : ""}`,
      quantity: 1,
      unit_price: shippingWithDiscount,
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
    // Force PIX-only if discount was applied
    ...(pixOnly ? {
      payment_methods: {
        excluded_payment_methods: [
          { id: "credit_card" },
          { id: "debit_card" },
          { id: "atm" },
          { id: "ticket" },
          { id: "bank_transfer" }
        ],
        excluded_payment_types: [
          { id: "credit_card" },
          { id: "debit_card" },
          { id: "ticket" }
        ],
        default_payment_method_id: "pix",
      }
    } : {}),
    metadata: {
      orderNumber,
      customerName,
      customerEmail: customerEmail || "",
      customerPhone,
      address: address || "",
      streetNumber: streetNumber || "",
      neighborhood: neighborhood || "",
      city: city || "",
      state: state || "",
      zipCode: zipCode || "",
      cpfCnpj: cpfCnpj || "",
      notes: notes || "",
      customerId: customerId || "",
      items: JSON.stringify(items),
      pixOnly: pixOnly ? "true" : "false",
      discountAmount: discountAmount || 0,
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
    console.error("MP preference error:", mpRes.status, err);
    console.error("Preference sent:", JSON.stringify(preference, null, 2));
    try {
      const errJson = JSON.parse(err);
      console.error("[MP] Preference error:", errJson);
      return NextResponse.json({ error: "Erro ao criar preferência MP" }, { status: 500 });
    } catch {
      console.error("[MP] Preference error:", err);
      return NextResponse.json({ error: "Erro ao criar preferência MP" }, { status: 500 });
    }
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
      streetNumber: streetNumber || null,
      neighborhood: neighborhood || null,
      city: city || null,
      state: state || null,
      zipCode: zipCode || null,
      cpfCnpj: cpfCnpj || null,
      notes: notes || null,
      customerId: customerId || null,
      subtotal,
      shippingCost: shippingCost || 0,
      shippingMethod: shippingMethod || null,
      total,
      status: "PENDING",
      paymentMethod: "Mercado Pago",
      ...getMetaOrderContext(req),
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

  // Stock is taken only when the payment is confirmed (webhook -> commitOrderStock)

  return NextResponse.json({
    initPoint: mpData.init_point,
    sandboxInitPoint: mpData.sandbox_init_point,
    orderNumber,
  });
}
