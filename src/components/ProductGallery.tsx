import { useState } from "react";
import { ProductImage } from "./ProductImage";
import type { ProductImageRow } from "@/lib/products";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  imagenes: ProductImageRow[];
  fallbackWebp?: string | null;
  fallbackSrc?: string | null;
  alt: string;
};

export function ProductGallery({ imagenes, fallbackWebp, fallbackSrc, alt }: Props) {
  // Si no hay galería usar la imagen principal del producto como única.
  const items: { webp: string | null; src: string | null; alt: string }[] = imagenes.length
    ? imagenes.map((i) => ({ webp: i.url_webp ?? null, src: i.url ?? null, alt: i.alt ?? alt }))
    : [{ webp: fallbackWebp ?? null, src: fallbackSrc ?? null, alt }];

  const [idx, setIdx] = useState(0);
  const current = items[Math.min(idx, items.length - 1)];

  return (
    <div className="space-y-3">
      <div className="relative aspect-square bg-muted border border-border overflow-hidden group">
        <ProductImage
          webp={current.webp}
          src={current.src}
          alt={current.alt}
          className="size-full"
          iconClassName="size-48 text-foreground/20"
          loading="eager"
          sizes="(max-width: 1024px) 100vw, 600px"
        />
        {items.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 size-9 grid place-items-center bg-background/90 border border-border opacity-0 group-hover:opacity-100 transition hover:text-primary"
              aria-label="Imagen anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % items.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-9 grid place-items-center bg-background/90 border border-border opacity-0 group-hover:opacity-100 transition hover:text-primary"
              aria-label="Imagen siguiente"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur px-2 py-1 text-[10px] uppercase tracking-wider">
              {idx + 1} / {items.length}
            </div>
          </>
        )}
      </div>

      {items.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`aspect-square overflow-hidden border bg-muted/40 transition ${
                i === idx ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/40"
              }`}
              aria-label={`Ver imagen ${i + 1}`}
            >
              <ProductImage
                webp={it.webp}
                src={it.src}
                alt={it.alt}
                className="size-full"
                iconClassName="size-6"
                sizes="100px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
