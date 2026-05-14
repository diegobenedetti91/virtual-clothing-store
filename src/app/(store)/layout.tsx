export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCompanySettings } from "@/lib/company";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import WhatsAppFloat from "@/components/store/WhatsAppFloat";
import CustomerInit from "@/components/store/CustomerInit";
import CartSyncer from "@/components/store/CartSyncer";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  await cookies();
  const [settings, navItems] = await Promise.all([
    getCompanySettings(),
    prisma.navItem.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }).catch(() => []),
  ]);
  const brandColor = settings?.buttonColor || settings?.primaryColor || "#ec4899";
  const menuColor = (settings as Record<string, string> | null)?.menuColor || settings?.primaryColor || "#ec4899";

  return (
    <div className="min-h-screen flex flex-col" style={{ "--brand": brandColor, "--menu": menuColor } as React.CSSProperties}>
      <CustomerInit />
      <CartSyncer />
      <Header settings={settings} navItems={navItems} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} />
      {settings?.whatsapp && <WhatsAppFloat whatsapp={settings.whatsapp} />}
    </div>
  );
}
