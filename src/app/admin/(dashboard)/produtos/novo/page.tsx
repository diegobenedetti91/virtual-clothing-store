import { prisma } from "@/lib/prisma";
import ProductForm from "@/components/admin/ProductForm";
import { Category } from "@/types";

export default async function NewProductPage() {
  const [categories, navItems, variationTemplates, packages] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.navItem.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.variationTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.packagePreset.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <ProductForm
      categories={categories as unknown as Category[]}
      navItems={navItems}
      variationTemplates={variationTemplates}
      packages={packages as unknown as import("@/types").PackagePreset[]}
    />
  );
}
