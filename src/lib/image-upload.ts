import { supabase } from "@/integrations/supabase/client";

const MAX_BYTES = 5 * 1024 * 1024;

/** Sube un Blob ya procesado (recortado y convertido a WebP en browser) al bucket. */
export async function uploadProductImage(blob: Blob, ext: "webp" | "jpeg" | "jpg" | "png", productoId?: number) {
  if (blob.size > MAX_BYTES) throw new Error("Imagen procesada demasiado grande (máx 5 MB).");
  const folder = productoId ? `${productoId}` : "misc";
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(key, blob, {
    contentType: blob.type || (ext === "webp" ? "image/webp" : "image/jpeg"),
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(key);
  return { url: data.publicUrl, key, isWebp: ext === "webp" };
}

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
