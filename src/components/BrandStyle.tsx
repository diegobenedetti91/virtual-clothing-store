/**
 * Aplica as cores cadastradas no admin na raiz da página (:root).
 * Assim a barra de rolagem, a seleção de texto e as variáveis derivadas
 * (--brand-light, --brand-hover…) usam a cor da loja, não o rosa padrão.
 */
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i;

export default function BrandStyle({ brand, menu }: { brand?: string | null; menu?: string | null }) {
  const b = brand && SAFE_COLOR.test(brand.trim()) ? brand.trim() : null;
  const m = menu && SAFE_COLOR.test(menu.trim()) ? menu.trim() : null;
  if (!b && !m) return null;
  const css = `:root{${b ? `--brand:${b};` : ""}${m ? `--menu:${m};` : ""}}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
