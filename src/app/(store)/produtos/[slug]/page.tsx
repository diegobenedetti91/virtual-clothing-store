import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star, Truck, Zap, Store, RefreshCw, CreditCard, ShieldCheck } from "lucide-react";
import { getPublicCompanySettings } from "@/lib/company";
import { storePerks, type PerkIcon } from "@/lib/storePerks";
import { prisma } from "@/lib/prisma";
import type { Product } from "@/types";
import { getProductAttributes, normalizeVariantStock } from "@/lib/variantUtils";
import ProductGallery from "@/components/store/ProductGallery";
import ProductActions from "@/components/store/ProductActions";
import ProductReviews from "@/components/store/ProductReviews";
import { MetaViewContent } from "@/components/store/MetaPixel";
import { applyFlashSales } from "@/lib/flashSales";
import { FlashSaleTimer } from "@/components/store/FlashSaleTimer";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const settingsPromise = getPublicCompanySettings();
  const raw = await prisma.product.findUnique({
    where: { slug },
    include: { category: true, _count: { select: { reviews: { where: { approved: true } } } } },
  });

  if (!raw || !raw.active) notFound();

  const product = (await applyFlashSales([raw]))[0] as unknown as Product;
  const settings = await settingsPromise;
  const pixPercent = settings?.pixDiscountEnabled ? settings.pixDiscountPercent ?? 0 : 0;
  const PERK_ICONS: Record<PerkIcon, React.ComponentType<{ size?: number; className?: string }>> = {
    pix: Zap, truck: Truck, store: Store, refresh: RefreshCw, card: CreditCard, shield: ShieldCheck,
  };
  // Pix já aparece junto do preço; aqui entram entrega, troca e pagamento
  const perks = storePerks(settings).filter((p) => p.icon !== "pix").slice(0, 3);
  const images = JSON.parse(product.images || "[]") as string[];
  const attributes = getProductAttributes({
    attributes: product.attributes || "[]",
    sizes: product.sizes || "[]",
    colors: product.colors || "[]",
  });
  const normalizedVariants = normalizeVariantStock(JSON.parse(product.variantStock || "[]"));
  const firstImage = images[0] || "/placeholder-product.svg";
  const reviewCount = (raw as unknown as { _count: { reviews: number } })._count.reviews;

  const discount =
    product.comparePrice && product.comparePrice > product.price
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : 0;

  return (
    <div className="bg-white min-h-screen">
      {/* Breadcrumb */}
      <div className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Link href="/" className="hover:text-gray-700 transition-colors">Início</Link>
            <ChevronRight size={12} />
            <Link href="/produtos" className="hover:text-gray-700 transition-colors">Produtos</Link>
            {product.category && (
              <>
                <ChevronRight size={12} />
                <Link href={`/produtos?category=${product.category.slug}`} className="hover:text-gray-700 transition-colors">
                  {product.category.name}
                </Link>
              </>
            )}
            <ChevronRight size={12} />
            <span className="text-gray-700 font-semibold truncate max-w-[160px]">{product.name}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16">

          {/* Gallery */}
          <ProductGallery images={images} name={product.name} />

          {/* Info panel */}
          <div className="flex flex-col gap-5 lg:sticky lg:top-32 lg:self-start">

            {/* Category + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {product.category && (
                <Link
                  href={`/produtos?category=${product.category.slug}`}
                  className="text-xs font-bold text-brand uppercase tracking-widest hover:opacity-80 transition-opacity"
                >
                  {product.category.name}
                </Link>
              )}
              {product.featured && (
                <span className="bg-brand-light text-brand text-xs font-bold px-2.5 py-1 rounded-full border border-brand">
                  ★ Destaque
                </span>
              )}
              {discount > 0 && (
                <span className="bg-red-50 text-red-600 text-xs font-bold px-2.5 py-1 rounded-full border border-red-100">
                  -{discount}% OFF
                </span>
              )}
            </div>

            {/* Title */}
            <div>
              <h1 className="text-2xl sm:text-[28px] font-bold text-gray-900 leading-tight tracking-tight">
                {product.name}
              </h1>
              {reviewCount > 0 && (
                <a href="#avaliacoes" className="mt-1.5 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
                  <Star size={14} className="text-amber-400" fill="currentColor" />
                  {reviewCount} avaliação{reviewCount !== 1 ? "ões" : ""}
                </a>
              )}
              {product.description && (
                <p className="mt-3 text-[15px] text-gray-600 leading-relaxed">{product.description}</p>
              )}
            </div>

            {product.flashSale && (
              <FlashSaleTimer
                flashSale={{ id: product.flashSale.id, title: product.flashSale.title, endAt: product.flashSale.endAt, discountType: "", discountValue: 0 }}
              />
            )}

            {/* Divider */}
            <div className="border-t border-gray-100" />

            <MetaViewContent productId={product.id} name={product.name} price={product.price} />

            {/* Actions (price, size, color, add to cart) */}
            <ProductActions
              productId={product.id}
              name={product.name}
              price={product.price}
              comparePrice={product.comparePrice}
              image={firstImage}
              slug={product.slug}
              attributes={attributes}
              stock={product.stock}
              variantStock={normalizedVariants}
              pixPercent={pixPercent}
            />

            {/* Vantagens da loja (vindas das configurações) */}
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {perks.map((p) => {
                const Icon = PERK_ICONS[p.icon];
                return (
                  <li key={p.title} className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-2.5">
                    <Icon size={16} className="text-gray-500 shrink-0" />
                    <span className="leading-tight">
                      <span className="block text-xs font-semibold text-gray-800">{p.title}</span>
                      <span className="block text-[11px] text-gray-500">{p.desc}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Reviews */}
        <div id="avaliacoes">
          <ProductReviews productId={product.id} />
        </div>

        {/* Back */}
        <div className="mt-10 pt-8 border-t border-gray-100">
          <Link
            href="/produtos"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-brand transition-colors"
          >
            <ChevronLeft size={16} />
            Voltar para produtos
          </Link>
        </div>
      </div>
    </div>
  );
}
