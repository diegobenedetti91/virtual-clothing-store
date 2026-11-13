import { getPublicCompanySettings } from "@/lib/company";
import { storePerks } from "@/lib/storePerks";
import type { AuthBrand } from "./AuthShell";

/** Identidade da loja para as telas de conta (nome, logo, banner e vantagens reais). */
export async function getAuthBrand(): Promise<AuthBrand> {
  const s = await getPublicCompanySettings().catch(() => null);
  let heroImage: string | null = null;
  try {
    const banners = JSON.parse(s?.bannerImages || "[]");
    heroImage = Array.isArray(banners) && typeof banners[0] === "string" ? banners[0] : null;
  } catch {}
  return { storeName: s?.name || "Minha loja", logo: s?.logo || null, heroImage, perks: storePerks(s).slice(0, 4) };
}
