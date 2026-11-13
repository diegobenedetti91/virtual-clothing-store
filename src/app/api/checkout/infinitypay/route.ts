import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTrafficOrderContext } from "@/lib/trafficSourceServer";
import { webhookToken } from "@/lib/webhookToken";
import { validateCheckout } from "@/lib/checkoutValidation";
import { getMetaOrderContext } from "@/lib/metaCapi";
import { generateOrderNumber } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerName, customerEmail, customerPhone, address, city, state, zipCode, notes, items: rawItems, shippingMethod, pixOnly = false, couponCode, cpfCnpj } = body;

  if (!customerName || !customerPhone) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const checked = await validateCheckout(req, { items: rawItems, zipCode, shippingMethod, pixOnly, couponCode, customerEmail, cpfCnpj });
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const { items, productMap, subtotal, shippingCost, discountAmount, customerId } = checked;

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const handle = settings?.infinityPayHandle;
  const apiKey = settings?.infinityPayApiKey;

  if (!handle || !apiKey) {
    return NextResponse.json({ error: "Infinity Pay não configurado" }, { status: 400 });
  }


  let ipItems = items.map((item: { productId: string; quantity: number; size?: string; color?: string }) => {
    const product = productMap.get(item.productId);
    if (!product) throw new Error(`Produto não encontrado: ${item.productId}`);
    return {
      price: Math.round(product.price * 100),
      quantity: item.quantity,
      description: `${product.name}${item.size ? ` (${item.size})` : ""}${item.color ? ` - ${item.color}` : ""}`,
    };
  });

  const total = Math.round((subtotal + shippingCost - discountAmount) * 100) / 100;
  const orderNumber = generateOrderNumber();
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  // Sem item negativo: desconto até o frete sai do frete; acima disso, uma linha com o total exato
  if (discountAmount > (shippingCost || 0)) {
    const units = items.reduce((s: number, i: { quantity: number }) => s + i.quantity, 0);
    ipItems = [{ price: Math.round(total * 100), quantity: 1, description: `Pedido ${orderNumber} (${units} ${units === 1 ? "item" : "itens"})` }];
  } else if (shippingCost && shippingCost > 0) {
    const shippingWithDiscount = Math.round((shippingCost - (discountAmount || 0)) * 100) / 100;
    if (shippingWithDiscount > 0) {
      ipItems.push({
        price: Math.round(shippingWithDiscount * 100),
        quantity: 1,
        description: `Frete${shippingMethod ? ` (${shippingMethod})` : ""}`,
      });
    }
  }

  const payload: Record<string, any> = {
    handle,
    items: ipItems,
    order_nsu: orderNumber,
    redirect_url: `${baseUrl}/checkout/sucesso?order=${orderNumber}`,
    webhook_url: `${baseUrl}/api/checkout/infinitypay/webhook?token=${webhookToken(orderNumber)}`,
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

  // Restrict payment methods if PIX discount was applied
  if (pixOnly) {
    payload.payment_methods = ["pix"];
  }

  try {
    console.log("\n📤 [Infinity Pay] Enviando requisição");
    console.log("Handle:", handle);
    console.log("Items:", JSON.stringify(ipItems));
    console.log("Order NSU:", orderNumber);
    console.log("PIX Only:", pixOnly);
    console.log("Payment Methods:", payload.payment_methods);

    const ipRes = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("📥 [Infinity Pay] Status:", ipRes.status);

    if (!ipRes.ok) {
      const err = await ipRes.text();
      console.error("❌ [Infinity Pay] Erro na resposta:");
      console.error("Status:", ipRes.status);
      console.error("Body:", err);
      return NextResponse.json({
        error: "Erro ao criar link de pagamento Infinity Pay",
        status: ipRes.status,
        details: err
      }, { status: 500 });
    }

    const ipData = await ipRes.json();
    console.log("✅ [Infinity Pay] Resposta completa:", JSON.stringify(ipData));

    const paymentUrl = ipData.url;

    if (!paymentUrl) {
      console.error("❌ [Infinity Pay] URL não encontrada na resposta:", ipData);
      return NextResponse.json({ error: "Infinity Pay não retornou URL de pagamento" }, { status: 500 });
    }

    console.log("✅ [Infinity Pay] Link gerado:", paymentUrl);

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
        couponCode: checked.coupon?.code ?? null,
        couponDiscount: checked.couponDiscount,
        status: "PENDING",
        paymentMethod: "Infinity Pay",
        ...getMetaOrderContext(req),
        ...getTrafficOrderContext(req),
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
    console.error("\n❌ [Infinity Pay] Erro na integração:");
    console.error("Tipo:", error instanceof Error ? "Error" : typeof error);
    console.error("Mensagem:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }

    return NextResponse.json({
      error: "Erro ao processar pagamento",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
