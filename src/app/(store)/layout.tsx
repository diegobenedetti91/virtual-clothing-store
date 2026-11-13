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

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  await cookies();
  const [settings, navItems] = await Promise.all([
    getPublicCompanySettings(),
    prisma.navItem.findMany({ where: { active: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }).catch(() => []),
  ]);
  const brandColor = settings?.buttonColor || settings?.primaryColor || "#ec4899";
  const menuColor = (settings as Record<string, string> | null)?.menuColor || settings?.primaryColor || "#ec4899";

  return (
    <div className="min-h-screen flex flex-col" style={{ "--brand": brandColor, "--menu": menuColor } as React.CSSProperties}>
      <CustomerInit />
      <CartSyncer />
      <TrafficSourceTracker />
      <MetaPixelPageView pixelId={settings?.metaPixelId ?? null} />
      <Header settings={settings} navItems={navItems} />
      <ScrollReveal />
      <ViewTransition name="store-page">
        <main className="flex-1">{children}</main>
      </ViewTransition>
      <Footer settings={settings} />
      {settings?.aiAssistantAvailable ? (
        <AiChatWidget storeName={settings.name || "Loja"} whatsapp={settings.whatsapp ?? null} />
      ) : (
        settings?.whatsapp && <WhatsAppFloat whatsapp={settings.whatsapp} />
      )}
      <CookieConsentBanner />
    </div>
  );
}
