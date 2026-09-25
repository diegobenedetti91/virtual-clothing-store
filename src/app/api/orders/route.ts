import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/utils";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { normalizeVariantStock, matchesSelection } from "@/lib/variantUtils";

export async function GET(req: NextRequest) {
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
  const { customerName, customerEmail, customerPhone, address, streetNumber, neighborhood, city, state, zipCode, cpfCnpj, items, notes, customerId, shippingCost, shippingMethod } = body;

  type OrderItemInput = {
    productId: string;
    quantity: number;
    price: number;
    // Legacy
    size?: string;
    color?: string;
    // New
    selectedAttributes?: Record<string, string>;
  };

  let subtotal = 0;
  for (const item of items as OrderItemInput[]) {
    subtotal += item.price * item.quantity;
  }
  const shipping = typeof shippingCost === "number" ? shippingCost : 0;

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
        items: {
          create: await Promise.all((items as OrderItemInput[]).map(async (item) => {
            const prod = await tx.product.findUnique({
              where: { id: item.productId },
              select: { blingProdutoId: true },
            });
            return {
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
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
