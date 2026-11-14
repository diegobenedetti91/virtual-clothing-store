"use client";

import { forwardRef, useState } from "react";
import { imageSrcSet, imageVariant, isOptimizable, type ImageWidth } from "@/lib/imageUrl";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> & {
  src: string | null | undefined;
  /** Larguras oferecidas ao navegador (ele escolhe pela tela e por `sizes`) */
  widths?: readonly ImageWidth[];
  /** Imagem usada se a original também falhar */
  fallback?: string;
};

/**
 * <img> que pede a versão do tamanho certo (WebP) e, se ela falhar por qualquer
 * motivo, volta para a foto original — nunca fica uma imagem quebrada.
 */
const OptimizedImg = forwardRef<HTMLImageElement, Props>(function OptimizedImg({ src, widths = [480, 800], sizes, fallback = "/placeholder-product.svg", onError, ...rest }, ref) {
  const [stage, setStage] = useState<0 | 1 | 2>(0); // 0 = versão otimizada, 1 = original, 2 = fallback
  const [lastSrc, setLastSrc] = useState(src);
  if (lastSrc !== src) {
    setLastSrc(src);
    setStage(0);
  }
  const optimizable = isOptimizable(src);
  const useVariant = optimizable && stage === 0;
  const finalSrc = stage === 2 || !src ? fallback : useVariant ? imageVariant(src, widths[widths.length - 1]) : src;

  return (
    <img
      ref={ref}
      {...rest}
      src={finalSrc}
      srcSet={useVariant ? imageSrcSet(src, widths) : undefined}
      sizes={useVariant ? sizes : undefined}
      onError={(e) => {
        setStage((s) => (s === 0 && optimizable ? 1 : 2));
        onError?.(e);
      }}
    />
  );
});

export default OptimizedImg;
