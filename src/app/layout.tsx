import type { Metadata } from "next";
import { Geist } from "next/font/google";
import SessionProvider from "@/components/admin/SessionProvider";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loja de Roupas",
  description: "Sua loja virtual de moda",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
