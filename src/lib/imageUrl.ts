/**
 * Versões redimensionadas das fotos enviadas pela loja.
 *
 * `/uploads/x.jpg` ou `/api/files/x.jpg` → `/api/files/x.jpg.w480.webp`.
 * A rota /api/files gera a versão na primeira vez (sharp, WebP) e guarda no
 * disco; daí em diante serve direto com cache de 1 ano. URLs externas e
 * data: ficam como estão. Se a versão falhar, o componente volta à original.
 */
export const IMAGE_WIDTHS = [160, 320, 480, 800, 1200, 1920] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

const LOCAL = /^\/(?:uploads|api\/files)\/([^/?#]+)$/;

export function isOptimizable(url: string | null | undefined): url is string {
  if (!url) return false;
  const m = url.match(LOCAL);
  // .gif fica como está (animação) e não gera versão de versão
  return !!m && !/\.gif$/i.test(m[1]) && !/\.w\d+\.webp$/i.test(m[1]);
}

export function imageVariant(url: string | null | undefined, width: ImageWidth): string {
  if (!url) return "";
  if (!isOptimizable(url)) return url;
  const name = url.match(LOCAL)![1];
  return `/api/files/${name}.w${width}.webp`;
}

export function imageSrcSet(url: string | null | undefined, widths: readonly ImageWidth[]): string | undefined {
  if (!isOptimizable(url)) return undefined;
  return widths.map((w) => `${imageVariant(url, w)} ${w}w`).join(", ");
}
