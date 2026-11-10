import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTrafficOrderContext } from "@/lib/trafficSourceServer";
import { validateCheckout } from "@/lib/checkoutValidation";
import { auth } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/utils";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { normalizeVariantStock, matchesSelection } from "@/lib/variantUtils";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { customerName: { contains: search } },
      { customerEmail: { contains: search } },
      { customerPhone: { contains: search } },
    ];
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, unknown>).lte = end;
    }
  }

  const orders = await prisma.order.findMany({
    where,
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerName, customerEmail, customerPhone, address, streetNumber, neighborhood, city, state, zipCode, cpfCnpj, items: rawItems, notes, shippingMethod } = body;

  if (!customerName || !customerPhone) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  // Prices, shipping and owner come from the server, never from the request body
  const checked = await validateCheckout(req, { items: rawItems, zipCode, shippingMethod, pixOnly: false });
  if ("error" in checked) return NextResponse.json({ error: checked.error }, { status: 400 });
  const { items, productMap, subtotal, shippingCost: shipping, customerId } = checked;


  const orderNumber = generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    // NOTE: Stock is NOT decremented here. It will be decremented when payment is confirmed via webhook.
    // This ensures stock is only reduced for paid orders.

    return tx.order.create({
      data: {
        orderNumber,
        customerName,
        customerEmail: customerEmail || null,
        customerPhone,
        address: address || null,
        streetNumber: streetNumber || null,
        neighborhood: neighborhood || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        cpfCnpj: cpfCnpj || null,
        subtotal,
        shippingCost: shipping,
        shippingMethod: shippingMethod || null,
        total: subtotal + shipping,
        notes: notes || null,
        customerId: customerId || null,
        ...getTrafficOrderContext(req),
        items: {
          create: await Promise.all(items.map(async (item) => {
            const prod = await tx.product.findUnique({
              where: { id: item.productId },
              select: { blingProdutoId: true },
            });
            return {
              productId: item.productId,
              quantity: item.quantity,
              price: productMap.get(item.productId)!.price,
              size: item.size || null,
              color: item.color || null,
              selectedAttributes: item.selectedAttributes
                ? JSON.stringify(item.selectedAttributes)
                : null,
              blingProdutoId: prod?.blingProdutoId || null,
            };
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });
  });

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });

  const emailTarget = customerEmail || null;
  if (emailTarget) {
    sendOrderConfirmationEmail({
      to: emailTarget,
      customerName,
      orderNumber,
      storeName: settings?.name || "Minha Loja",
      items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
      total: subtotal + shipping,
      isGateway: false,
    }).catch(console.error);
  }

  return NextResponse.json(order, { status: 201 });
}
