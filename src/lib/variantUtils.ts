import { ProductAttribute } from "@/types";

export interface NormalizedVariant {
  attributes: Record<string, string>;
  stock: number;
}

// Normalize variantStock: handles both old {size, color} and new {attributes} format
export function normalizeVariantStock(raw: unknown[]): NormalizedVariant[] {
  return (raw as Array<{ attributes?: Record<string, string>; size?: string; color?: string; stock: number }>).map((v) => {
    if (v.attributes) return { attributes: v.attributes, stock: v.stock };
    const attrs: Record<string, string> = {};
    if (v.size) attrs["Tamanho"] = v.size;
    if (v.color) attrs["Cor"] = v.color;
    return { attributes: attrs, stock: v.stock };
  });
}

// Get attribute definitions — prefers new `attributes` field, falls back to legacy sizes/colors
export function getProductAttributes(product: {
  attributes: string;
  sizes: string;
  colors: string;
}): ProductAttribute[] {
  const attrs = JSON.parse(product.attributes || "[]") as ProductAttribute[];
  if (attrs.length > 0) return attrs;

  const result: ProductAttribute[] = [];
  const sizes = JSON.parse(product.sizes || "[]") as string[];
  const colors = JSON.parse(product.colors || "[]") as string[];
  if (sizes.length > 0) result.push({ name: "Tamanho", values: sizes });
  if (colors.length > 0) result.push({ name: "Cor", values: colors });
  return result;
}

// Check if a variant's attributes fully match a given selection
export function matchesSelection(
  variantAttrs: Record<string, string>,
  selected: Record<string, string>
): boolean {
  return Object.entries(selected).every(([k, v]) => !v || variantAttrs[k] === v);
}

// Get stock for a given selection (exact match first, then partial sum)
export function getStockForSelection(
  variants: NormalizedVariant[],
  selected: Record<string, string>
): number {
  const keys = Object.keys(selected).filter((k) => selected[k]);
  if (keys.length === 0) return variants.reduce((s, v) => s + v.stock, 0);

  const allKeys = variants.length > 0 ? Object.keys(variants[0].attributes) : [];
  const isExact = keys.length === allKeys.length || allKeys.every((k) => selected[k]);

  if (isExact) {
    return variants.find((v) => matchesSelection(v.attributes, selected))?.stock ?? 0;
  }

  // Partial: sum all variants matching the selected subset
  return variants
    .filter((v) => keys.every((k) => v.attributes[k] === selected[k]))
    .reduce((s, v) => s + v.stock, 0);
}

// Human-readable label for a set of selected attributes
export function attributesLabel(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" / ");
}

// Generate all combinations of attribute values for the variant stock matrix
export function generateCombinations(attributes: ProductAttribute[]): Array<Record<string, string>> {
  if (attributes.length === 0) return [];
  return attributes.reduce<Array<Record<string, string>>>(
    (combos, attr) =>
      combos.flatMap((combo) =>
        attr.values.map((val) => ({ ...combo, [attr.name]: val }))
      ),
    [{}]
  );
}

// Build a stable string key from selected attributes for dedup/comparison
export function variantKey(attrs: Record<string, string>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(attrs).sort(([a], [b]) => a.localeCompare(b)))
  );
}
