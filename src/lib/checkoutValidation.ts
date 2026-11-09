import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerFromRequest } from "@/lib/customerAuth";
import { resolveShippingCost } from "@/lib/shippingCalc";

// Everything that decides how much the customer pays is computed here, on the
// server. The browser only says WHAT it wants (products, quantities, shipping
// option, Pix or not); prices, shipping cost, discount and owner come from us.

export interface CheckoutItem {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
  selectedAttributes?: Record<string, string>;
}

type Product = Awaited<ReturnType<typeof prisma.product.findMany>>[number];

export interface ValidatedCheckout {
  items: CheckoutItem[];
  productMap: Map<string, Product>;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  customerId: string | null;
}

const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;
const round2 = (n: number) => Math.round(n * 100) / 100;

function parseItems(raw: unknown): CheckoutItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) return null;
  const items: CheckoutItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") return null;
    const i = r as Record<string, unknown>;
    if (typeof i.productId !== "string" || !i.productId) return null;
    if (typeof i.quantity !== "number" || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > MAX_QUANTITY) {
      return null;
    }
    let selectedAttributes: Record<string, string> | undefined;
    if (i.selectedAttributes && typeof i.selectedAttributes === "object") {
      const entries = Object.entries(i.selectedAttributes as Record<string, unknown>);
      if (entries.some(([k, v]) => typeof v !== "string" || k.length > 50 || v.length > 100)) return null;
      selectedAttributes = Object.fromEntries(entries) as Record<string, string>;
    }
    items.push({
      productId: i.productId,
      quantity: i.quantity,
      size: typeof i.size === "string" ? i.size.slice(0, 50) : undefined,
      color: typeof i.color === "string" ? i.color.slice(0, 50) : undefined,
      selectedAttributes,
    });
  }
  return items;
}

export async function validateCheckout(
  req: NextRequest,
  input: { items: unknown; zipCode?: string | null; shippingMethod?: string | null; pixOnly?: unknown }
): Promise<ValidatedCheckout | { error: string }> {
  const items = parseItems(input.items);
  if (!items) return { error: "Itens do pedido inválidos" };

  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.productId))] }, active: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));
  if (items.some((i) => !productMap.has(i.productId))) return { error: "Produto indisponível" };

  const subtotal = round2(items.reduce((sum, i) => sum + productMap.get(i.productId)!.price * i.quantity, 0));

  const shippingCost = await resolveShippingCost(input.zipCode, items, input.shippingMethod);
  if (shippingCost === null) return { error: "Opção de frete inválida. Recalcule o frete e tente novamente." };

  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  const pixPercent = settings?.pixDiscountEnabled ? settings.pixDiscountPercent ?? 0 : 0;
  const discountAmount = input.pixOnly === true && pixPercent > 0 ? round2((subtotal * pixPercent) / 100) : 0;

  return {
    items,
    productMap,
    subtotal,
    shippingCost,
    discountAmount,
    customerId: getCustomerFromRequest(req)?.id ?? null,
  };
}
