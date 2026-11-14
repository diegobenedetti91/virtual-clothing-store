export const dynamic = "force-dynamic";

import { ViewTransition } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPublicCompanySettings } from "@/lib/company";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import WhatsAppFloat from "@/components/store/WhatsAppFloat";
import AiChatWidget from "@/components/store/AiChatWidget";
import CustomerInit from "@/components/store/CustomerInit";
import CartSyncer from "@/components/store/CartSyncer";
import { MetaPixelPageView } from "@/components/store/MetaPixel";
import { CookieConsentBanner } from "@/components/store/CookieConsent";
import TrafficSourceTracker from "@/components/store/TrafficSourceTracker";
import ScrollReveal from "@/components/store/ScrollReveal";
import BrandStyle from "@/components/BrandStyle";
import CouponLinkCatcher from "@/components/store/CouponLinkCatcher";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  await cookies();
  const [settings, navItems, categories] = await Promise.all([
    getPublicCompanySettings(),
    prisma.navItem.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }).catch(() => []),
    prisma.category
      .findMany({
        where: { active: true, products: { some: { active: true } } },
        select: { id: true, name: true, slug: true, image: true },
        orderBy: { name: "asc" },
      })
      .catch(() => []),
  ]);
  // Cada cor com o seu papel: principal (destaques), botões (ações) e menu (cabeçalho)
  const primaryColor = settings?.primaryColor || "#ec4899";
  const buttonColor = settings?.buttonColor || primaryColor;
  const menuColor = (settings as Record<string, string> | null)?.menuColor || primaryColor;

  return (
    <div className="min-h-screen flex flex-col" style={{ "--brand": primaryColor, "--button": buttonColor, "--menu": menuColor } as React.CSSProperties}>
      <BrandStyle brand={primaryColor} button={buttonColor} menu={menuColor} />
      <CustomerInit />
      <CartSyncer />
      <TrafficSourceTracker />
      <MetaPixelPageView pixelId={settings?.metaPixelId ?? null} />
      <Header settings={settings} navItems={navItems} categories={categories} />
      <ScrollReveal />
      <CouponLinkCatcher />
      <ViewTransition name="store-page">
        <main className="flex-1">{children}</main>
      </ViewTransition>
      <Footer settings={settings} categories={categories} />
      {settings?.aiAssistantAvailable ? (
        <AiChatWidget storeName={settings.name || "Loja"} whatsapp={settings.whatsapp ?? null} />
      ) : (
        settings?.whatsapp && <WhatsAppFloat whatsapp={settings.whatsapp} />
      )}
      <CookieConsentBanner />
    </div>
  );
}
