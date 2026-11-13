import { prisma } from "@/lib/prisma";
import WaitlistManager, { type WaitlistProductInfo } from "@/components/admin/WaitlistManager";

export const dynamic = "force-dynamic";

export default async function ListaDeEsperaPage() {
  // Foto e estoque atual dos produtos com gente esperando (a rota da lista não traz isso)
  const products = await prisma.product
    .findMany({
      where: { waitlist: { some: {} } },
      select: { id: true, images: true, stock: true, variantStock: true, active: true },
    })
    .catch(() => []);

  const info: Record<string, WaitlistProductInfo> = {};
  for (const p of products) {
    let image: string | null = null;
    try { const imgs = JSON.parse(p.images || "[]"); image = Array.isArray(imgs) ? imgs[0] ?? null : null; } catch {}
    let variants: unknown[] = [];
    try { const v = JSON.parse(p.variantStock || "[]"); variants = Array.isArray(v) ? v : []; } catch {}
    info[p.id] = { image, stock: p.stock, variantStock: variants, active: p.active };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Lista de espera</h1>
        <p className="text-sm text-gray-500 mt-1">
          Clientes que pediram para ser avisados quando um produto voltar. Use como termômetro de reposição: quanto mais gente esperando, mais vale repor.
        </p>
      </div>
      <WaitlistManager productInfo={info} />
    </div>
  );
}
