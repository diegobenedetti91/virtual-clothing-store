import { prisma } from "@/lib/prisma";
import CategoryManager from "@/components/admin/CategoryManager";
import { Category } from "@/types";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  }) as unknown as Category[];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
        <p className="text-gray-500 text-sm mt-1">Organize seus produtos por categorias</p>
      </div>
      <CategoryManager initialCategories={categories} />
    </div>
  );
}
