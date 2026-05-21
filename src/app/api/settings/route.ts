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
    checkoutMessage, mercadoPagoPublicKey, mercadoPagoAccessToken, nuPayClientId, nuPayClientSecret,
    heroBadge, heroTitle, heroButtonText, heroButtonSecondaryText,
    freteAtivo, freteTipo, freteValorFixo, freteCEPOrigem, fretePesoDefaultGramas,
    melhorEnvioToken, fretePacoteAltura, fretePacoteLargura, fretePacoteComprimento,
    freteLocalCidade,
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
    nuPayClientId: nuPayClientId || null,
    nuPayClientSecret: nuPayClientSecret || null,
    heroBadge: heroBadge || null,
    heroTitle: heroTitle || null,
    heroButtonText: heroButtonText || null,
    heroButtonSecondaryText: heroButtonSecondaryText || null,
    freteAtivo: !!freteAtivo,
    freteTipo: freteTipo || "fixo",
    freteValorFixo: typeof freteValorFixo === "number" ? freteValorFixo : 0,
    freteCEPOrigem: freteCEPOrigem || null,
    fretePesoDefaultGramas: typeof fretePesoDefaultGramas === "number" ? fretePesoDefaultGramas : 500,
    melhorEnvioToken: melhorEnvioToken || null,
    fretePacoteAltura: typeof fretePacoteAltura === "number" ? fretePacoteAltura : 5,
    fretePacoteLargura: typeof fretePacoteLargura === "number" ? fretePacoteLargura : 12,
    fretePacoteComprimento: typeof fretePacoteComprimento === "number" ? fretePacoteComprimento : 17,
    freteLocalCidade: freteLocalCidade || null,
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
