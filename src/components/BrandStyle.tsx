/**
 * Aplica as cores cadastradas no admin na raiz da página (:root).
 *  --brand  = cor principal  · --button = cor dos botões  · --menu = cor do menu
 * Para botão e menu também calcula a cor do texto (branco ou quase preto) pelo contraste,
 * para continuar legível mesmo se a loja escolher uma cor clara.
 */
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;

function clean(c?: string | null) {
  return c && SAFE_COLOR.test(c.trim()) ? c.trim() : null;
}

/** Luminância relativa (WCAG) de uma cor #rgb/#rrggbb; null se não for hex. */
function luminance(color: string): number | null {
  let hex = color.replace("#", "");
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?([0-9a-f]{2})?$/i.test(hex)) return null;
  if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texto branco ou escuro, o que tiver mais contraste com o fundo. */
export function readableOn(color: string): string {
  const L = luminance(color);
  if (L == null) return "#ffffff";
  const white = 1.05 / (L + 0.05);
  const dark = (L + 0.05) / (0.0175 + 0.05); // #1f1f1f aprox.
  return dark > white ? "#1f2937" : "#ffffff";
}

export default function BrandStyle({ brand, button, menu }: { brand?: string | null; button?: string | null; menu?: string | null }) {
  const p = clean(brand);
  const b = clean(button);
  const m = clean(menu);
  if (!p && !b && !m) return null;
  const vars = [
    p && `--brand:${p}`,
    p && `--brand-fg:${readableOn(p)}`,
    b && `--button:${b}`,
    b && `--button-fg:${readableOn(b)}`,
    !b && p && `--button-fg:${readableOn(p)}`,
    m && `--menu:${m}`,
    m && `--menu-fg:${readableOn(m)}`,
    !m && p && `--menu-fg:${readableOn(p)}`,
  ].filter(Boolean);
  return <style dangerouslySetInnerHTML={{ __html: `:root{${vars.join(";")}}` }} />;
}
