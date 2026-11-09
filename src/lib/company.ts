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
  "nuPayClientSecret",
  "melhorEnvioToken",
  "melhorEnvioApiToken",
  "melhorEnvioWebhookSecret",
  "metaCapiAccessToken",
  "metaTestEventCode",
  "infinityPayApiKey",
  "blingClientSecret",
  "blingAccessToken",
  "blingRefreshToken",
] as const;

type SecretField = (typeof SECRET_SETTINGS_FIELDS)[number];
type Settings = NonNullable<Awaited<ReturnType<typeof getCompanySettings>>>;
export type PublicCompanySettings = Omit<Settings, SecretField> & { infinityPayConfigured: boolean };

export function toPublicSettings(settings: Settings | null): PublicCompanySettings | null {
  if (!settings) return null;
  const copy: Record<string, unknown> = { ...settings };
  for (const field of SECRET_SETTINGS_FIELDS) delete copy[field];
  copy.infinityPayConfigured = !!settings.infinityPayApiKey;
  return copy as PublicCompanySettings;
}

/** Settings safe to send to the browser. Use this anywhere outside the admin. */
export const getPublicCompanySettings = cache(async () => toPublicSettings(await getCompanySettings()));
