import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const ORDER = { orderBy: { updatedAt: "desc" } } as const;

export async function GET() {
  let settings = await prisma.companySettings.findFirst(ORDER);
  if (!settings) {
    settings = await prisma.companySettings.create({
      data: { name: "Minha Loja de Roupas" },
    });
  }
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const {
    name, logo, phone, whatsapp, instagram, address, description,
    primaryColor, bannerImages, checkoutType, checkoutCollectEmail, checkoutCollectAddress,
    checkoutMessage, mercadoPagoPublicKey, mercadoPagoAccessToken,
  } = body;

  let settings = await prisma.companySettings.findFirst(ORDER);
  const data = {
    name,
    logo: logo || null,
    phone: phone || null,
    whatsapp: whatsapp || null,
    instagram: instagram || null,
    address: address || null,
    description: description || null,
    primaryColor: primaryColor || "#ec4899",
    bannerImages: JSON.stringify(bannerImages || []),
    checkoutType: checkoutType || "whatsapp",
    checkoutCollectEmail: !!checkoutCollectEmail,
    checkoutCollectAddress: !!checkoutCollectAddress,
    checkoutMessage: checkoutMessage || null,
    mercadoPagoPublicKey: mercadoPagoPublicKey || null,
    mercadoPagoAccessToken: mercadoPagoAccessToken || null,
  };

  if (settings) {
    settings = await prisma.companySettings.update({ where: { id: settings.id }, data });
    // Remove duplicate rows, keeping only the one we just updated
    await prisma.companySettings.deleteMany({ where: { id: { not: settings.id } } });
  } else {
    settings = await prisma.companySettings.create({ data });
  }

  revalidatePath("/");
  revalidatePath("/produtos");
  return NextResponse.json(settings);
}
