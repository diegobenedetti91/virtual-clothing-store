import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/admin/ProductForm";
import { notFound } from "next/navigation";
import { Category, Product } from "@/types";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, navItems, variationTemplates, packages] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { category: true, navItems: { select: { id: true, label: true } } } }),
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.navItem.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.variationTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.packagePreset.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <ProductForm
      product={product as unknown as Product}
      categories={categories as unknown as Category[]}
      navItems={navItems}
      variationTemplates={variationTemplates}
      packages={packages as unknown as import("@/types").PackagePreset[]}
    />
  );
}
