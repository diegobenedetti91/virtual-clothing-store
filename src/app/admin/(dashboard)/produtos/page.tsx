import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Package } from "lucide-react";
import ProductsTable from "@/components/admin/ProductsTable";
import BlingProductSyncButton from "@/components/admin/BlingProductSyncButton";

export default async function AdminProductsPage() {
  const now = new Date();
  const [products, settings, flashSales] = await Promise.all([
    prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.companySettings.findFirst(),
    // Promoções relâmpago no ar agora (só para mostrar o selo na lista)
    prisma.flashSale.findMany({
      where: { active: true, startAt: { lte: now }, endAt: { gte: now }, productId: { not: null } },
      select: { productId: true },
    }),
  ]);

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
          <Link
            href="/admin/produtos/novo"
            className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 active:scale-[0.98] transition"
          >
            <Plus size={16} /> Novo produto
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 py-16 text-center">
          <Package size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-700">Nenhum produto cadastrado ainda</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">Cadastre o primeiro produto com fotos, preço e variações.</p>
          <Link href="/admin/produtos/novo" className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-semibold">
            <Plus size={15} /> Cadastrar produto
          </Link>
        </div>
      ) : (
        <ProductsTable products={products} flashSaleProductIds={flashIds} />
      )}
    </div>
  );
}
