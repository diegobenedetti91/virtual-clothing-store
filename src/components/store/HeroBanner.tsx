"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { CompanySettings } from "@/types";

interface HeroBannerProps {
  settings?: CompanySettings | null;
}

export default function HeroBanner({ settings }: HeroBannerProps) {
  const [current, setCurrent] = useState(0);
  const banners = JSON.parse(settings?.bannerImages || "[]") as string[];

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (!banners.length) {
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 min-h-[600px] flex items-center">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-pink-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/4 w-[480px] h-[480px] bg-fuchsia-300/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-gray-900 leading-[1.05] tracking-tight mb-5">
              {settings?.name || "Moda com"}
              <br />
              <span className="bg-gradient-to-r from-pink-600 to-fuchsia-600 bg-clip-text text-transparent">
                estilo e
              </span>
              <br />
              qualidade.
            </h1>

            {settings?.description && (
              <p className="text-lg text-gray-500 mb-8 leading-relaxed max-w-md">
                {settings.description}
              </p>
            )}

            <div className="flex flex-wrap gap-3 mb-10">
              <Link
                href="/produtos"
                className="inline-flex items-center gap-2 bg-pink-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-pink-700 transition-all shadow-lg hover:shadow-pink-200/60 hover:shadow-xl active:scale-[0.97]"
              >
                Ver coleção
                <ArrowRight size={18} />
              </Link>
              {settings?.instagram && (
                <a
                  href={`https://instagram.com/${settings.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white text-gray-800 px-8 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all border border-gray-200 shadow-sm active:scale-[0.97]"
                >
                  📷 Nosso Instagram
                </a>
              )}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="text-green-500 font-bold">✓</span> Qualidade garantida
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-green-500 font-bold">✓</span> Frete a combinar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-green-500 font-bold">✓</span> Atendimento pelo WhatsApp
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-center relative">
            <div className="absolute w-72 h-72 bg-pink-300/30 rounded-full blur-xl" />
            <div className="absolute w-48 h-48 bg-fuchsia-300/30 rounded-full blur-lg translate-x-16 translate-y-12" />
            <div className="absolute w-36 h-36 bg-rose-300/25 rounded-full blur-lg -translate-x-16 -translate-y-8" />
            <span className="relative text-[180px] select-none drop-shadow-2xl" style={{ filter: "drop-shadow(0 20px 40px rgba(236,72,153,0.25))" }}>
              👗
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gray-900" style={{ height: "560px" }}>
      {banners.map((src, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? "opacity-100" : "opacity-0"}`}
        >
          <img src={src} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
        </div>
      ))}

      <div className="relative z-10 flex flex-col items-start justify-center h-full text-white px-8 sm:px-16 max-w-3xl">
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-6 drop-shadow-lg leading-tight">
          {settings?.name || "Nossa Coleção"}
        </h1>
        {settings?.description && (
          <p className="text-white/80 text-lg mb-8 max-w-sm">{settings.description}</p>
        )}
        <Link
          href="/produtos"
          className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-2xl font-bold hover:bg-pink-600 hover:text-white transition-all shadow-xl active:scale-[0.97]"
        >
          Ver coleção <ArrowRight size={18} />
        </Link>
      </div>

      {banners.length > 1 && (
        <>
          <button
            onClick={() => setCurrent((c) => (c - 1 + banners.length) % banners.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/15 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-sm transition"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => setCurrent((c) => (c + 1) % banners.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/15 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-sm transition"
          >
            <ChevronRight size={22} />
          </button>
          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2 z-20">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${i === current ? "bg-white w-8" : "bg-white/40 w-2"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
