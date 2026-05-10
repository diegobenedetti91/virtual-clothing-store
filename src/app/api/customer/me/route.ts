import { NextResponse } from "next/server";
import { getCustomerFromCookie } from "@/lib/customerAuth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const payload = await getCustomerFromCookie();
  if (!payload) return NextResponse.json(null);

  const customer = await prisma.customerUser.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  return NextResponse.json(customer);
}
