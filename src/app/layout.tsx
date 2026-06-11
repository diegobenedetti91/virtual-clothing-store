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
                appId: "47e5daed-ae5d-47e9-a0d0-1ed2fa2c4aa1",
                safari_web_id: "web.onesignal.auto.2b467c5d-2ccd-4e09-a57b-cb7ab9efd0c0",
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
