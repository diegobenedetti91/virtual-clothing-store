/** Cores mais comuns em nomes de variação → CSS. */
const COLOR_CSS: Record<string, string> = {
  azul: "#3b82f6", vermelho: "#ef4444", verde: "#22c55e", preto: "#18181b", preta: "#18181b",
  branco: "#f4f4f5", branca: "#f4f4f5", rosa: "#ec4899", amarelo: "#eab308", amarela: "#eab308", laranja: "#f97316",
  roxo: "#8b5cf6", roxa: "#8b5cf6", cinza: "#71717a", marrom: "#78350f", bege: "#d6bc96",
  caramelo: "#c08b5c", nude: "#e8c9a0", vinho: "#7f1d1d", navy: "#1e3a5f", marinho: "#1e3a5f",
  coral: "#fb7185", salmão: "#fda4af", salmao: "#fda4af", turquesa: "#2dd4bf", dourado: "#d97706", dourada: "#d97706",
  prata: "#9ca3af", off: "#f5f0e1", offwhite: "#f5f0e1", "off-white": "#f5f0e1", creme: "#f5ecd7", lilás: "#c4b5fd", lilas: "#c4b5fd",
  khaki: "#a3a062", cáqui: "#a3a062", mostarda: "#ca8a04", verde_militar: "#4d5d33", jeans: "#4a6fa5", grafite: "#3f3f46",
  chumbo: "#52525b", lavanda: "#b4a7d6", menta: "#98e2c6", terracota: "#c2410c", ferrugem: "#b45309",
};

function one(name: string): string | null {
  const key = name.toLowerCase().trim().replace(/\s+/g, " ");
  if (COLOR_CSS[key]) return COLOR_CSS[key];
  const compact = key.replace(/[\s-]/g, "");
  if (COLOR_CSS[compact]) return COLOR_CSS[compact];
  const first = key.split(" ")[0];
  return COLOR_CSS[first] ?? null;
}

export function colorToCss(name: string): string {
  return one(name) ?? "#9ca3af";
}

/**
 * Fundo da bolinha de cor. Nomes com duas cores ("Marrom com azul", "Preto e branco")
 * viram meio a meio. Retorna null quando não reconhece nenhuma cor.
 */
export function swatchBackground(name: string): string | null {
  const parts = name.toLowerCase().split(/\s+(?:com|e|\/|&|\+)\s+|\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
  const colors = parts.map(one).filter((c): c is string => !!c);
  if (colors.length === 0) return null;
  if (colors.length === 1) return colors[0];
  return `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`;
}

/** Atributo de cor? (Cor, Cores, Color) */
export const isColorAttribute = (name: string) => ["cor", "cores", "color", "colors"].includes(name.toLowerCase().trim());
