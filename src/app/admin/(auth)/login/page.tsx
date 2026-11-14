import { getPublicCompanySettings } from "@/lib/company";
import BrandStyle from "@/components/BrandStyle";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const s = await getPublicCompanySettings().catch(() => null);
  return { title: `Entrar · ${s?.name || "Painel"}` };
}

/** Login do admin com a identidade da loja (nome, logo, descrição, banner e cores das Configurações). */
export default async function AdminLoginPage() {
  const s = await getPublicCompanySettings().catch(() => null);
  let heroImage: string | null = null;
  try {
    const banners = JSON.parse(s?.bannerImages || "[]");
    heroImage = Array.isArray(banners) && typeof banners[0] === "string" ? banners[0] : null;
  } catch {}

  return (
    <>
      <BrandStyle brand={s?.primaryColor} button={s?.buttonColor || s?.primaryColor} />
      <AdminLoginForm storeName={s?.name || "Minha loja"} logo={s?.logo || null} description={s?.description || null} heroImage={heroImage} />
    </>
  );
}
