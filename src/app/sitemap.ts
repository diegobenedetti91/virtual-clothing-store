import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

// Gerado a cada pedido (com cache curto do navegador/CDN), para nunca depender do banco na hora do build
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { slug: true, updatedAt: true, images: true }, orderBy: { updatedAt: "desc" }, take: 45000 }),
    prisma.category.findMany({ where: { active: true }, select: { slug: true } }),
  ]);
  const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${base}${u}`);
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/produtos`, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({ url: `${base}/produtos?category=${encodeURIComponent(c.slug)}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.map((p) => {
      let images: string[] = [];
      try { images = (JSON.parse(p.images || "[]") as string[]).slice(0, 3).map(abs); } catch {}
      return { url: `${base}/produtos/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8, images };
    }),
  ];
}
