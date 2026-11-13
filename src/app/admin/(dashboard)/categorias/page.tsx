import { prisma } from "@/lib/prisma";
import CategoryManager from "@/components/admin/CategoryManager";
import { Category } from "@/types";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  }) as unknown as Category[];

  return <CategoryManager initialCategories={categories} />;
}
