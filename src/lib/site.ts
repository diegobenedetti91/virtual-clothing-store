/** Endereço público da loja (para SEO, sitemap e links absolutos). */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/** Converte "/uploads/x.jpg" em "https://loja.com/uploads/x.jpg"; URLs completas ficam como estão. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Texto curto para meta description (sem quebras, até ~160 caracteres). */
export function metaDescription(text: string | null | undefined, fallback = ""): string {
  const clean = (text || fallback).replace(/\s+/g, " ").trim();
  return clean.length > 160 ? `${clean.slice(0, 157).trimEnd()}…` : clean;
}
