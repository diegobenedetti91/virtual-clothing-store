import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "@/lib/utils";
import { sendOrderConfirmationEmail } from "@/lib/email";

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
    include: {
      items: { include: { product: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerName, customerEmail, customerPhone, address, city, state, zipCode, items, notes, customerId } = body;

  type OrderItem = { productId: string; quantity: number; price: number; size?: string; color?: string };

  let subtotal = 0;
  for (const item of items as OrderItem[]) {
    subtotal += item.price * item.quantity;
  }

  const orderNumber = generateOrderNumber();

  const order = await prisma.$transaction(async (tx) => {
    // Decrement stock for each item
    for (const item of items as OrderItem[]) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return tx.order.create({
      data: {
        orderNumber,
        customerName,
        customerEmail: customerEmail || null,
        customerPhone,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        subtotal,
        total: subtotal,
        notes: notes || null,
        customerId: customerId || null,
        items: {
          create: (items as OrderItem[]).map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            size: item.size || null,
            color: item.color || null,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });
  });

  // Send confirmation email (WhatsApp flow — no gateway)
  const emailTarget = customerEmail || null;
  if (emailTarget) {
    const settings = await prisma.companySettings.findFirst({ select: { name: true } });
    sendOrderConfirmationEmail({
      to: emailTarget,
      customerName,
      orderNumber,
      storeName: settings?.name || "Minha Loja",
      items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
      total: subtotal,
      isGateway: false,
    }).catch(console.error);
  }

  return NextResponse.json(order, { status: 201 });
}
