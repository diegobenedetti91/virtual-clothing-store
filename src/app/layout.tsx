import type { Metadata } from "next";
import { Geist } from "next/font/google";
import SessionProvider from "@/components/admin/SessionProvider";
import { getCompanySettings } from "@/lib/company";
import Script from "next/script";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getCompanySettings();
  const name = settings?.name || "Loja de Roupas";
  return {
    title: name,
    description: settings?.description || "Sua loja virtual de moda",
};
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <head>
        <Script
          src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
          defer
          strategy="lazyOnload"
        />
        <Script id="onesignal-init" strategy="lazyOnload">
          {`
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            OneSignalDeferred.push(async function(OneSignal) {
              await OneSignal.init({
                appId: "${process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID}",
                safari_web_id: "${process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_ID}",
                notifyButton: {
                  enable: true,
                },
              });
            });
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
