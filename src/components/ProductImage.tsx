import { Package } from "lucide-react";
import { useState } from "react";

type Props = {
  webp?: string | null;
  src?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
  sizes?: string;
  loading?: "lazy" | "eager";
};

export function ProductImage({
  webp,
  src,
  alt,
  className = "",
  iconClassName = "size-16",
  sizes = "(max-width: 768px) 50vw, 25vw",
  loading = "lazy",
}: Props) {
  const [failed, setFailed] = useState(false);
  const fallback = src ?? webp ?? null;

  if (!fallback || failed) {
    return (
      <div className={`grid place-items-center text-muted-foreground/40 ${className}`}>
        <Package className={iconClassName} strokeWidth={1} />
      </div>
    );
  }

  return (
    <picture className={className}>
      {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
      <img
        src={fallback}
        alt={alt}
        loading={loading}
        decoding="async"
        sizes={sizes}
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    </picture>
  );
}
