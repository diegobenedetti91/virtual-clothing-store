import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toPublicSettings } from "@/lib/company";
import { AI_MODELS, DEFAULT_AI_MODEL } from "@/lib/aiModels";

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
    melhorEnvioToken, melhorEnvioApiToken, melhorEnvioWebhookSecret, metaPixelId, metaCapiAccessToken, metaTestEventCode, aiAssistantEnabled, aiApiKey, aiModel, aiPolicies, aiDailyMessageLimit, fretePacoteAltura, fretePacoteLargura, fretePacoteComprimento,
    freteLocalCidade, freteLocalUF, freteLocalRegioes, freteLocalRetirada, mercadoPagoAtivo, mercadoPagoTransparente, nuPayAtivo, nuPaySandbox,
    infinityPayAtivo, infinityPayHandle, infinityPayApiKey,
    pixDiscountEnabled, pixDiscountPercent, whatsappAtivo,
    blingAtivo, blingNfeAuto, blingClientId, blingClientSecret, diasUteisProduzao, monthlyRevenueGoal, salesTaxRate,
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
    aiAssistantEnabled: !!aiAssistantEnabled,
    aiApiKey: typeof aiApiKey === "string" && aiApiKey.trim() ? aiApiKey.trim() : null,
    aiModel: AI_MODELS.some((m) => m.id === aiModel) ? aiModel : DEFAULT_AI_MODEL,
    aiPolicies: typeof aiPolicies === "string" && aiPolicies.trim() ? aiPolicies.trim().slice(0, 20000) : null,
    aiDailyMessageLimit: Number.isInteger(aiDailyMessageLimit) && aiDailyMessageLimit > 0 ? Math.min(aiDailyMessageLimit, 100000) : 300,
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
    nuPaySandbox: !!nuPaySandbox,
    infinityPayAtivo: !!infinityPayAtivo,
    infinityPayHandle: infinityPayHandle || null,
    infinityPayApiKey: infinityPayApiKey || null,
    whatsappAtivo: !!whatsappAtivo,
    pixDiscountEnabled: !!pixDiscountEnabled,
    pixDiscountPercent: typeof pixDiscountPercent === "number" ? pixDiscountPercent : 0,
    blingAtivo: !!blingAtivo,
    blingNfeAuto: !!blingNfeAuto,
    blingClientId: blingClientId || null,
    blingClientSecret: blingClientSecret || null,
    diasUteisProduzao: typeof diasUteisProduzao === "number" ? diasUteisProduzao : 2,
    // Meta do mês: número > 0, ou vazio para não ter meta
    monthlyRevenueGoal:
      typeof monthlyRevenueGoal === "number" && Number.isFinite(monthlyRevenueGoal) && monthlyRevenueGoal > 0
        ? Math.min(monthlyRevenueGoal, 1e9)
        : null,
    // Alíquota de imposto sobre vendas (%): 0 < x < 100, ou vazio
    salesTaxRate:
      typeof salesTaxRate === "number" && Number.isFinite(salesTaxRate) && salesTaxRate > 0 && salesTaxRate < 100
        ? Math.round(salesTaxRate * 100) / 100
        : null,
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
