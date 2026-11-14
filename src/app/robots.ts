import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/api/files/"], // fotos dos produtos ficam em /api/files
      // Áreas privadas e de compra não precisam aparecer no Google
      disallow: ["/admin", "/api/", "/checkout", "/carrinho", "/conta", "/pedido/", "/favoritos"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
