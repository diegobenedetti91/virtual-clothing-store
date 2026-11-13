import { prisma } from "@/lib/prisma";
import AvaliacoesManager from "@/components/admin/AvaliacoesManager";

export const dynamic = "force-dynamic";

export default async function AvaliacoesPage() {
  // Foto de cada produto avaliado (a API de avaliações só traz nome e slug)
  const products = await prisma.product
    .findMany({ where: { reviews: { some: {} } }, select: { id: true, images: true } })
    .catch(() => []);
  const productImages = Object.fromEntries(
    products.map((p) => {
      try {
        const imgs = JSON.parse(p.images || "[]");
        return [p.id, Array.isArray(imgs) ? (imgs[0] as string) ?? null : null];
      } catch {
        return [p.id, null];
      }
    })
  );

  return <AvaliacoesManager productImages={productImages} />;
}
