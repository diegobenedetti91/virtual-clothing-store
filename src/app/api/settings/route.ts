import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toPublicSettings } from "@/lib/company";

const ORDER = { orderBy: { updatedAt: "desc" } } as const;

export async function GET() {
  const settings = await prisma.companySettings.findFirst(ORDER);
  // Credentials only go to a logged-in admin; the storefront gets the public subset.
  const session = await auth();
  return NextResponse.json(session ? settings ?? null : toPublicSettings(settings));
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    name, logo, phone, whatsapp, instagram, address, cnpj, description,
    primaryColor, buttonColor, menuColor, bannerImages, checkoutType, checkoutCollectEmail, checkoutCollectAddress,
    checkoutMessage, mercadoPagoPublicKey, mercadoPagoAccessToken, nuPayClientId, nuPayClientSecret,
    heroBadge, heroTitle, heroButtonText, heroButtonSecondaryText,
    freteAtivo, freteTipo, freteValorFixo, freteCEPOrigem, fretePesoDefaultGramas,
    melhorEnvioToken, melhorEnvioApiToken, melhorEnvioWebhookSecret, metaPixelId, metaCapiAccessToken, metaTestEventCode, fretePacoteAltura, fretePacoteLargura, fretePacoteComprimento,
    freteLocalCidade, freteLocalUF, freteLocalRegioes, freteLocalRetirada, mercadoPagoAtivo, mercadoPagoTransparente, nuPayAtivo,
    infinityPayAtivo, infinityPayHandle, infinityPayApiKey,
    pixDiscountEnabled, pixDiscountPercent, whatsappAtivo,
    blingAtivo, blingClientId, blingClientSecret, diasUteisProduzao,
  } = body;

  let settings = await prisma.companySettings.findFirst(ORDER);
  const data = {
    name,
    logo: logo || null,
    phone: phone || null,
    whatsapp: whatsapp || null,
    instagram: instagram || null,
    address: address || null,
    cnpj: cnpj || null,
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
    melhorEnvioApiToken: melhorEnvioApiToken || null,
    melhorEnvioWebhookSecret: melhorEnvioWebhookSecret || null,
    metaPixelId: typeof metaPixelId === "string" && /^\d{5,25}$/.test(metaPixelId.trim()) ? metaPixelId.trim() : null,
    metaCapiAccessToken: typeof metaCapiAccessToken === "string" && metaCapiAccessToken.trim() ? metaCapiAccessToken.trim() : null,
    metaTestEventCode: typeof metaTestEventCode === "string" && metaTestEventCode.trim() ? metaTestEventCode.trim() : null,
    fretePacoteAltura: typeof fretePacoteAltura === "number" ? fretePacoteAltura : 5,
    fretePacoteLargura: typeof fretePacoteLargura === "number" ? fretePacoteLargura : 12,
    fretePacoteComprimento: typeof fretePacoteComprimento === "number" ? fretePacoteComprimento : 17,
    freteLocalCidade: freteLocalCidade || null,
    freteLocalUF: freteLocalUF || null,
    freteLocalRegioes: freteLocalRegioes || null,
    freteLocalRetirada: !!freteLocalRetirada,
    mercadoPagoAtivo: !!mercadoPagoAtivo,
    mercadoPagoTransparente: !!mercadoPagoTransparente,
    nuPayAtivo: !!nuPayAtivo,
    infinityPayAtivo: !!infinityPayAtivo,
    infinityPayHandle: infinityPayHandle || null,
    infinityPayApiKey: infinityPayApiKey || null,
    whatsappAtivo: !!whatsappAtivo,
    pixDiscountEnabled: !!pixDiscountEnabled,
    pixDiscountPercent: typeof pixDiscountPercent === "number" ? pixDiscountPercent : 0,
    blingAtivo: !!blingAtivo,
    blingClientId: blingClientId || null,
    blingClientSecret: blingClientSecret || null,
    diasUteisProduzao: typeof diasUteisProduzao === "number" ? diasUteisProduzao : 2,
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
