import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, RotateCcw, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import type { Product } from "@/types";
import ProductGallery from "@/components/store/ProductGallery";
import ProductActions from "@/components/store/ProductActions";
import ProductReviews from "@/components/store/ProductReviews";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const raw = await prisma.product.findUnique({
    where: { slug },
    include: { category: true, _count: { select: { reviews: { where: { approved: true } } } } },
  });

  if (!raw || !raw.active) notFound();

  const product = raw as unknown as Product;
  const images = JSON.parse(product.images || "[]") as string[];
  const sizes = JSON.parse(product.sizes || "[]") as string[];
  const colors = JSON.parse(product.colors || "[]") as string[];
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20">

          {/* Gallery */}
          <ProductGallery images={images} name={product.name} />

          {/* Info panel */}
          <div className="flex flex-col gap-6">

            {/* Category + badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {product.category && (
                <Link
                  href={`/produtos?category=${product.category.slug}`}
                  className="text-xs font-bold text-pink-500 uppercase tracking-widest hover:text-pink-700 transition-colors"
                >
                  {product.category.name}
                </Link>
              )}
              {product.featured && (
                <span className="bg-pink-50 text-pink-600 text-xs font-bold px-2.5 py-1 rounded-full border border-pink-100">
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
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight tracking-tight">
              {product.name}
            </h1>

            {/* Description */}
            {product.description && (
              <p className="text-gray-500 leading-relaxed text-base">
                {product.description}
              </p>
            )}

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Actions (price, size, color, add to cart) */}
            <ProductActions
              productId={product.id}
              name={product.name}
              price={product.price}
              comparePrice={product.comparePrice}
              image={firstImage}
              slug={product.slug}
              sizes={sizes}
              colors={colors}
              stock={product.stock}
              variantStock={JSON.parse(product.variantStock || "[]")}
            />

            {/* Info cards (Estoque is inside ProductActions, variant-aware) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {reviewCount > 0 && (
                <a href="#avaliacoes" className="flex items-center gap-2.5 bg-gray-50 rounded-2xl px-4 py-3 hover:bg-yellow-50 transition-colors">
                  <span className="text-yellow-400 text-base">★</span>
                  <div>
                    <p className="text-xs font-bold text-gray-700">Avaliações</p>
                    <p className="text-xs text-gray-500">{reviewCount} avaliação{reviewCount !== 1 ? "ões" : ""}</p>
                  </div>
                </a>
              )}
              <div className="flex items-center gap-2.5 bg-gray-50 rounded-2xl px-4 py-3">
                <MessageCircle size={16} className="text-green-500 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-gray-700">Pagamento</p>
                  <p className="text-xs text-gray-500">Combinado via WhatsApp</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 bg-gray-50 rounded-2xl px-4 py-3">
                <RotateCcw size={16} className="text-blue-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-gray-700">Troca</p>
                  <p className="text-xs text-gray-500">Fácil e sem burocracia</p>
                </div>
              </div>
            </div>
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
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-pink-600 transition-colors"
          >
            <ChevronLeft size={16} />
            Voltar para produtos
          </Link>
        </div>
      </div>
    </div>
  );
}
