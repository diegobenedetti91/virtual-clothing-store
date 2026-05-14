import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const ORDER = { orderBy: { updatedAt: "desc" } } as const;

export async function GET() {
  const settings = await prisma.companySettings.findFirst(ORDER);
  return NextResponse.json(settings ?? null);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const {
    name, logo, phone, whatsapp, instagram, address, description,
    primaryColor, buttonColor, menuColor, bannerImages, checkoutType, checkoutCollectEmail, checkoutCollectAddress,
    checkoutMessage, mercadoPagoPublicKey, mercadoPagoAccessToken,
    heroBadge, heroTitle, heroButtonText, heroButtonSecondaryText,
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
    buttonColor: buttonColor || primaryColor || "#ec4899",
    menuColor: menuColor || primaryColor || "#ec4899",
    bannerImages: JSON.stringify(bannerImages || []),
    checkoutType: checkoutType || "whatsapp",
    checkoutCollectEmail: !!checkoutCollectEmail,
    checkoutCollectAddress: !!checkoutCollectAddress,
    checkoutMessage: checkoutMessage || null,
    mercadoPagoPublicKey: mercadoPagoPublicKey || null,
    mercadoPagoAccessToken: mercadoPagoAccessToken || null,
    heroBadge: heroBadge || null,
    heroTitle: heroTitle || null,
    heroButtonText: heroButtonText || null,
    heroButtonSecondaryText: heroButtonSecondaryText || null,
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
