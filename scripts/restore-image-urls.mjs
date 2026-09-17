/**
 * restore-image-urls.mjs
 * ----------------------
 * Revierte la migración de imágenes usando un backup generado por
 * migrate-images.mjs. Restaura las URLs originales en `productos` y
 * `product_images`.
 *
 * Uso:
 *   node scripts/restore-image-urls.mjs scripts/backups/image-urls-<timestamp>.json
 *   node scripts/restore-image-urls.mjs scripts/backups/image-urls-<timestamp>.json --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const backupFile = args.find((a) => !a.startsWith("--"));

if (!backupFile) {
  console.error("Uso: node scripts/restore-image-urls.mjs <backup.json> [--dry-run]");
  process.exit(1);
}

async function main() {
  const backup = JSON.parse(readFileSync(resolve(__dirname, "..", backupFile), "utf8"));
  console.log(`Backup: ${backupFile} (${backup.timestamp})`);
  console.log(`  productos: ${backup.productos.length} | product_images: ${backup.product_images.length}`);
  console.log(DRY_RUN ? "🧪 DRY-RUN: no se modifica nada" : "♻️  RESTAURANDO URLs ORIGINALES...");

  let updatedProducts = 0;
  let updatedGallery = 0;

  for (const p of backup.productos) {
    const patch = {};
    if (p.image_url !== undefined) patch.image_url = p.image_url;
    if (p.image_webp !== undefined) patch.image_webp = p.image_webp;
    if (Object.keys(patch).length === 0) continue;
    if (DRY_RUN) { updatedProducts++; continue; }
    const { error } = await supabase.from("productos").update(patch).eq("id", p.id);
    if (error) console.error(`  ✗ productos ${p.id}: ${error.message}`);
    else updatedProducts++;
  }

  for (const g of backup.product_images) {
    const patch = {};
    if (g.url !== undefined) patch.url = g.url;
    if (g.url_webp !== undefined) patch.url_webp = g.url_webp;
    if (Object.keys(patch).length === 0) continue;
    if (DRY_RUN) { updatedGallery++; continue; }
    const { error } = await supabase.from("product_images").update(patch).eq("id", g.id);
    if (error) console.error(`  ✗ product_images ${g.id}: ${error.message}`);
    else updatedGallery++;
  }

  console.log(`\n✅ Restaurados: ${updatedProducts} productos | ${updatedGallery} filas de galería`);
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});