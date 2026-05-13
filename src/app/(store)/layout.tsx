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
  return (
    <div className="min-h-screen flex flex-col">
      <CustomerInit />
      <CartSyncer />
      <Header settings={settings} navItems={navItems} />
      <main className="flex-1">{children}</main>
      <Footer settings={settings} />
      {settings?.whatsapp && <WhatsAppFloat whatsapp={settings.whatsapp} />}
    </div>
  );
}
