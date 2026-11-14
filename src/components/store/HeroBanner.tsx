"use client";

import { useState, useEffect } from "react";
import OptimizedImg from "@/components/OptimizedImg";
import { imageVariant, isOptimizable } from "@/lib/imageUrl";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { CompanySettings } from "@/types";

interface HeroBannerProps {
  settings?: CompanySettings | null;
}

function parseList(raw: string): string[] {
  try { return (JSON.parse(raw) as string[]).filter(Boolean); } catch { return []; }
}

export default function HeroBanner({ settings }: HeroBannerProps) {
  const [current, setCurrent] = useState(0);
  const raw = settings?.bannerImages || "[]";
  const all = parseList(raw);
  // Proporção (largura ÷ altura) de cada foto, medida por uma versão leve dela
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const [portraitScreen, setPortraitScreen] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const update = () => setPortraitScreen(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    for (const src of parseList(raw)) {
      const probe = new Image();
      let triedOriginal = false;
      probe.onload = () => {
        if (probe.naturalWidth && probe.naturalHeight) setRatios((r) => ({ ...r, [src]: probe.naturalWidth / probe.naturalHeight }));
      };
      probe.onerror = () => { if (!triedOriginal) { triedOriginal = true; probe.src = src; } };
      probe.src = isOptimizable(src) ? imageVariant(src, 480) : src;
    }
  }, [raw]);

  // Computador mostra as fotos horizontais; celular, as verticais.
  // Se só existir um formato, usa todas.
  const fit = portraitScreen == null ? [] : all.filter((src) => ratios[src] != null && (portraitScreen ? ratios[src] < 1 : ratios[src] >= 1));
  const banners = fit.length ? fit : all;

  const idx = banners.length ? current % banners.length : 0;
  const ratio = ratios[banners[idx]] ?? 16 / 7;

  useEffect(() => {
    if (banners.length <= 1) return;
    // Reinicia a contagem a cada troca (inclusive manual), em sincronia com a barra de progresso
    const t = setTimeout(() => setCurrent((c) => (c + 1) % banners.length), 5000);
    return () => clearTimeout(t);
  }, [banners.length, current]);

  const title = settings?.heroTitle || settings?.name;
  const primaryBtn = settings?.heroButtonText || "Ver coleção";
  const secondaryBtn = settings?.heroButtonSecondaryText;

  if (!banners.length) {
    if (!title && !settings?.description) return null;
    return (
      <section className="relative overflow-hidden min-h-[480px] flex items-center bg-brand-light">
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-3xl pointer-events-none animate-glow-drift" style={{ background: "color-mix(in srgb, var(--brand) 15%, transparent)" }} />
        <div className="absolute -bottom-24 left-1/4 w-[480px] h-[480px] bg-fuchsia-300/15 rounded-full blur-3xl pointer-events-none animate-glow-drift [animation-delay:-7s]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20">
          {settings?.heroBadge && (
            <p className="animate-fade-up inline-flex items-center gap-2 text-xs font-bold tracking-widest text-brand uppercase mb-4 bg-white/70 backdrop-blur px-3 py-1.5 rounded-full ring-1 ring-black/5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              {settings.heroBadge}
            </p>
          )}
          {title && (
            <h1 className="animate-fade-up [animation-delay:120ms] text-5xl sm:text-6xl lg:text-7xl font-black text-gray-900 leading-[1.05] tracking-tight mb-5">
              {title}
            </h1>
          )}
          {settings?.description && (
            <p className="animate-fade-up [animation-delay:240ms] text-lg text-gray-500 mb-8 leading-relaxed max-w-md">
              {settings.description}
            </p>
          )}
          <div className="animate-fade-up [animation-delay:360ms] flex flex-wrap gap-3">
            <Link
              href="/produtos"
              className="group inline-flex items-center gap-2 bg-brand text-white px-8 py-4 rounded-2xl font-bold hover:-translate-y-0.5 hover:shadow-[0_12px_40px_color-mix(in_srgb,var(--brand)_40%,transparent)] transition-all shadow-lg active:scale-[0.97]"
            >
              {primaryBtn} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            {!secondaryBtn && settings?.instagram ? (
              <a
                href={`https://instagram.com/${settings.instagram.replace("@", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white text-gray-800 px-8 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all border border-gray-200 shadow-sm active:scale-[0.97]"
              >
                📷 Nosso Instagram
              </a>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      className="relative overflow-hidden bg-gray-900 w-full transition-[aspect-ratio] duration-500"
      // Largura total; a altura segue a proporção da foto (foto inteira, sem corte),
      // limitada à altura da tela para o banner nunca passar dela
      style={{ aspectRatio: String(ratio), maxHeight: "calc(100svh - 88px)", minHeight: "220px" }}
    >
      {banners.map((src, i) => (
        <div
          key={src}
          className={`absolute inset-0 transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0"}`}
        >
          <OptimizedImg
            src={src}
            alt={`Banner ${i + 1}`}
            widths={[800, 1200, 1920]}
            sizes="100vw"
            decoding="async"
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "auto"}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) setRatios((r) => (r[src] ? r : { ...r, [src]: img.naturalWidth / img.naturalHeight }));
            }}
            className="w-full h-full object-cover object-[center_30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-black/5 to-transparent" />
        </div>
      ))}

      <div key={idx} className="absolute bottom-4 left-4 sm:bottom-8 sm:left-16 z-20 animate-fade-up [animation-delay:250ms]">
        <Link
          href="/produtos"
          className="group inline-flex items-center gap-2 bg-white/90 backdrop-blur-md text-gray-900 px-4 py-2.5 text-sm sm:px-8 sm:py-4 sm:text-base rounded-xl sm:rounded-2xl font-bold hover:bg-brand hover:text-white hover:-translate-y-0.5 transition-all shadow-xl active:scale-[0.97]"
        >
          {primaryBtn} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {banners.length > 1 && (
        <>
          <button
            onClick={() => setCurrent((idx - 1 + banners.length) % banners.length)}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 bg-white/15 hover:bg-white/30 text-white p-1.5 sm:p-3 rounded-full backdrop-blur-sm transition"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => setCurrent((idx + 1) % banners.length)}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 bg-white/15 hover:bg-white/30 text-white p-1.5 sm:p-3 rounded-full backdrop-blur-sm transition"
          >
            <ChevronRight size={22} />
          </button>
          <div className="absolute bottom-2 sm:bottom-5 right-4 sm:left-0 sm:right-0 flex justify-end sm:justify-center gap-2 z-20">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`Ir para o banner ${i + 1}`}
                className={`relative h-1.5 rounded-full overflow-hidden transition-all duration-300 ${i === idx ? "bg-white/40 w-10" : "bg-white/40 w-2 hover:bg-white/70"}`}
              >
                {i === idx && (
                  <span
                    key={`${idx}-${current}`}
                    className="absolute inset-y-0 left-0 bg-white rounded-full"
                    style={{ animation: "banner-progress 5s linear forwards" }}
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
