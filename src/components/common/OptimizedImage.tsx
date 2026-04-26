import React from "react";
import { cn } from "@/lib/utils";

export interface OptimizedImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Explicit width in px – required to prevent CLS */
  width: number;
  /** Explicit height in px – required to prevent CLS */
  height: number;
  /** Override the default "lazy" loading strategy for critical / hero images */
  priority?: boolean;
  /** Wrap in <picture> with webp <source> when the src is already webp */
  withPicture?: boolean;
}

/**
 * A performance-first image component that enforces:
 * - Explicit width / height to prevent CLS
 * - loading="lazy" by default (override with `priority`)
 * - decoding="async"
 * - Responsive max-width via Tailwind
 * - Optional <picture> wrapper for modern format fallback
 */
const OptimizedImage: React.FC<OptimizedImageProps> = ({
  width,
  height,
  priority = false,
  withPicture = false,
  className,
  alt = "",
  src,
  ...rest
}) => {
  const imgElement = (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...(priority ? ({ fetchpriority: "high" } as React.ImgHTMLAttributes<HTMLImageElement>) : {})}
      className={cn("max-w-full h-auto", className)}
      {...rest}
    />
  );

  if (withPicture && src) {
    const isWebP = typeof src === "string" && src.endsWith(".webp");
    return (
      <picture>
        {isWebP && <source srcSet={src} type="image/webp" />}
        {imgElement}
      </picture>
    );
  }

  return imgElement;
};

export default OptimizedImage;
