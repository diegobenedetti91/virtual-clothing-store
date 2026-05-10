import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromCookie } from "@/lib/customerAuth";

export async function GET() {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json(null);

  const customer = await prisma.customerUser.findUnique({
    where: { id: payload.id },
    select: {
      id: true, email: true, name: true,
      phone: true, street: true, number: true,
      neighborhood: true, city: true, state: true, zipCode: true,
    },
  });
  return NextResponse.json(customer);
}

export async function PATCH(req: NextRequest) {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { name, phone, street, number, neighborhood, city, state, zipCode } = body;

  const customer = await prisma.customerUser.update({
    where: { id: payload.id },
    data: {
      name: name || undefined,
      phone: phone || null,
      street: street || null,
      number: number || null,
      neighborhood: neighborhood || null,
      city: city || null,
      state: state || null,
      zipCode: zipCode || null,
    },
    select: {
      id: true, email: true, name: true,
      phone: true, street: true, number: true,
      neighborhood: true, city: true, state: true, zipCode: true,
    },
  });

  return NextResponse.json(customer);
}
