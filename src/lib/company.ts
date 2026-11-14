import { cache } from "react";
import { prisma } from "./prisma";

export const getCompanySettings = cache(async () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
    } catch (e) {
      if (attempt === 2) {
        console.error("[getCompanySettings] failed after 3 attempts:", e);
        return null;
      }
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  return null;
});

// Credentials that must never leave the server (API responses, client component props).
const SECRET_SETTINGS_FIELDS = [
  "mercadoPagoAccessToken",
  "nuPayClientId",
  "nuPayClientSecret",
  "melhorEnvioToken",
  "melhorEnvioApiToken",
  "melhorEnvioWebhookSecret",
  "metaCapiAccessToken",
  "metaTestEventCode",
  "aiApiKey",
  "infinityPayApiKey",
  // Meta de faturamento é dado interno do negócio
  "monthlyRevenueGoal",
  "salesTaxRate",
  "blingClientSecret",
  "blingAccessToken",
  "blingRefreshToken",
] as const;

type SecretField = (typeof SECRET_SETTINGS_FIELDS)[number];
type Settings = NonNullable<Awaited<ReturnType<typeof getCompanySettings>>>;
export type PublicCompanySettings = Omit<Settings, SecretField> & { infinityPayConfigured: boolean; nuPayConfigured: boolean; aiAssistantAvailable: boolean };

export function toPublicSettings(settings: Settings | null): PublicCompanySettings | null {
  if (!settings) return null;
  const copy: Record<string, unknown> = { ...settings };
  for (const field of SECRET_SETTINGS_FIELDS) delete copy[field];
  copy.infinityPayConfigured = !!settings.infinityPayApiKey;
  copy.nuPayConfigured = !!(settings.nuPayClientId && settings.nuPayClientSecret);
  copy.aiAssistantAvailable = !!(settings.aiAssistantEnabled && settings.aiApiKey);
  return copy as PublicCompanySettings;
}

/** Settings safe to send to the browser. Use this anywhere outside the admin. */
export const getPublicCompanySettings = cache(async () => toPublicSettings(await getCompanySettings()));
