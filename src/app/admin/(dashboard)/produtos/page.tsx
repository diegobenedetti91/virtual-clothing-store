import { prisma } from "@/lib/prisma";
import { ButtonLink } from "@/components/admin/ui/Button";
import { Plus, Package } from "lucide-react";
import ProductsTable from "@/components/admin/ProductsTable";
import BlingProductSyncButton from "@/components/admin/BlingProductSyncButton";

export default async function AdminProductsPage() {
  const now = new Date();
  const [rows, settings, flashSales] = await Promise.all([
    // Só o que a lista usa — sem descrição completa nem todas as fotos (deixa a página leve com muitos produtos)
    prisma.product.findMany({
      select: {
        id: true, name: true, slug: true, description: true, price: true, comparePrice: true, stock: true,
        active: true, featured: true, images: true, variantStock: true, createdAt: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.companySettings.findFirst({ select: { blingAtivo: true } }),
    // Promoções relâmpago no ar agora (só para mostrar o selo na lista)
    prisma.flashSale.findMany({
      where: { active: true, startAt: { lte: now }, endAt: { gte: now }, productId: { not: null } },
      select: { productId: true },
    }),
  ]);

  const products = rows.map((p) => {
    let first: string | undefined;
    try { first = (JSON.parse(p.images || "[]") as string[])[0]; } catch {}
    return {
      ...p,
      images: JSON.stringify(first ? [first] : []),
      description: p.description ? p.description.slice(0, 160) : null, // só para a busca
    };
  });

  const flashIds = flashSales.map((f) => f.productId!).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Produtos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}. Clique em um produto para editar preço, fotos e estoque.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {settings?.blingAtivo && <BlingProductSyncButton />}
          {/* Página de servidor: o ícone vai como filho (componente não pode ser passado como prop para um Client Component) */}
          <ButtonLink href="/admin/produtos/novo" variant="primary">
            <Plus /> Novo produto
          </ButtonLink>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <Package size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Nenhum produto cadastrado ainda</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">Cadastre o primeiro produto com fotos, preço e variações.</p>
          <ButtonLink href="/admin/produtos/novo" variant="dark" size="sm">
            <Plus /> Cadastrar produto
          </ButtonLink>
        </div>
      ) : (
        <ProductsTable products={products} flashSaleProductIds={flashIds} />
      )}
    </div>
  );
}
