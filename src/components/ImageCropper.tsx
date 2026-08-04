import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { X, Check, RotateCcw } from "lucide-react";

type Props = {
  /** Source URL or data URL of the image to crop. */
  src: string;
  /** Aspect ratio, default 1 (square). */
  aspect?: number;
  /** Max output dimension (longest side), default 1200. */
  maxSize?: number;
  /** WebP quality 0..1, default 0.85. */
  quality?: number;
  onCancel: () => void;
  onConfirm: (blob: Blob, ext: "webp" | "jpeg") => void | Promise<void>;
};

/**
 * Modal de recorte y normalización a WebP en el browser.
 * No depende de sharp ni de procesamiento server-side (runtime Cloudflare Worker).
 */
export function ImageCropper({ src, aspect = 1, maxSize = 1200, quality = 0.85, onCancel, onConfirm }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  async function confirm() {
    if (!area) return;
    setBusy(true);
    try {
      const { blob, ext } = await renderCroppedBlob(src, area, maxSize, quality);
      await onConfirm(blob, ext);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 grid place-items-center p-4">
      <div className="bg-background border border-border w-full max-w-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-display text-lg">Encuadrar imagen</h3>
          <button onClick={onCancel} className="p-1 hover:text-primary"><X className="size-5" /></button>
        </div>
        <div className="relative w-full aspect-square bg-black/60">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        </div>
        <div className="px-4 py-3 border-t border-border flex items-center gap-3">
          <RotateCcw className="size-4 text-muted-foreground" />
          <input
            type="range" min={1} max={4} step={0.05}
            value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-label="Zoom"
          />
          <button onClick={onCancel} className="px-3 py-2 text-sm">Cancelar</button>
          <button
            onClick={confirm}
            disabled={busy || !area}
            className="bg-primary text-primary-foreground px-4 py-2 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Check className="size-4" /> {busy ? "Procesando..." : "Confirmar"}
          </button>
        </div>
        <div className="px-4 pb-3 text-[11px] text-muted-foreground">
          Se exporta a <strong>.webp</strong> · ratio {aspect === 1 ? "1:1" : aspect.toFixed(2)} · máx {maxSize}px.
        </div>
      </div>
    </div>
  );
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderCroppedBlob(src: string, area: Area, maxSize: number, quality: number) {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSize / Math.max(area.width, area.height));
  const w = Math.round(area.width * scale);
  const h = Math.round(area.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no soportado");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, w, h);

  const tryWebp = await canvasToBlob(canvas, "image/webp", quality);
  if (tryWebp && tryWebp.type === "image/webp") {
    return { blob: tryWebp, ext: "webp" as const };
  }
  const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
  if (!jpeg) throw new Error("No se pudo exportar la imagen");
  return { blob: jpeg, ext: "jpeg" as const };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}
