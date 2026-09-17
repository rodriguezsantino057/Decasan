/**
 * migrate-images.mjs
 * ------------------
 * Migra las imágenes de productos desde URLs externas (scrapeadas de Google
 * Images) al bucket público de Supabase `product-images`.
 *
 * Características:
 *  - NO destructivo: nunca borra nada; solo actualiza URLs tras subir OK.
 *  - Backup previo: guarda el estado original en scripts/backups/ para poder
 *    revertir con restore-image-urls.mjs.
 *  - Idempotente: saltea URLs que ya apunten a Supabase; re-correr no duplica.
 *  - Deduplica por URL: cada URL única se descarga/sube UNA sola vez.
 *  - Baja concurrencia (4) + timeout, como un navegador, para no saturar
 *    los sitios de origen.
 *
 * Uso:
 *   node scripts/migrate-images.mjs                 # migra todo
 *   node scripts/migrate-images.mjs --dry-run       # solo reporta, no cambia nada
 *   node scripts/migrate-images.mjs --limit 50      # prueba con 50 URLs únicas
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { mkdirSync, writeFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const BUCKET = "product-images";
const CONCURRENCY = 3;
const TIMEOUT_MS = 20000;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB por imagen
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000]; // backoff entre reintentos
const DELAY_BETWEEN = 400; // pausa entre descargas para no saturar los sitios
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 ? parseInt(args[i + 1], 10) : Infinity;
})();

const isSupabaseUrl = (u) => (u || "").includes("supabase.co/storage");

/* ---------- helpers ---------- */

async function fetchAll(table, columns) {
  const all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    offset += limit;
  }
  return all;
}

function hash8(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function extFrom(url, contentType) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("webp")) return "webp";
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("avif")) return "avif";
  const m = url.split("?")[0].match(/\.(webp|png|jpe?g|gif|avif)$/i);
  return m ? m[1].toLowerCase() : "jpg";
}

async function download(url) {
  let last;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const wait = RETRY_DELAYS[attempt - 1] + Math.floor(Math.random() * 1000);
      console.log(`    ↻ reintento ${attempt}/${MAX_RETRIES} en ${wait}ms...`);
      await sleep(wait);
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*;q=0.8" },
      });
      clearTimeout(t);
      if (!r.ok) {
        last = { ok: false, status: r.status };
        // 4xx no tiene sentido reintentar (404, 403, etc.)
        if (r.status >= 400 && r.status < 500) return last;
        continue;
      }
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length === 0) { last = { ok: false, status: "EMPTY" }; continue; }
      if (buf.length > MAX_BYTES) return { ok: false, status: "TOO_BIG:" + buf.length };
      return { ok: true, buf, contentType: r.headers.get("content-type") || "" };
    } catch (e) {
      clearTimeout(t);
      last = { ok: false, status: "ERR:" + e.name };
      // errores de red/abort sí se reintentan
    }
  }
  return last;
}

async function uploadToBucket(buf, contentType, url) {
  const ext = extFrom(url, contentType);
  const key = `migrated/${hash8(url)}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: contentType || `image/${ext}`, upsert: true });
  if (error) return { ok: false, error: error.message };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return { ok: true, url: data.publicUrl };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/* ---------- main ---------- */

async function main() {
  console.log(DRY_RUN ? "🧪 MODO DRY-RUN (no se modifica nada)" : "🚀 MIGRANDO IMÁGENES A SUPABASE STORAGE");
  console.log("");

  // 1. Leer estado actual
  const [productos, galeria] = await Promise.all([
    fetchAll("productos", "id, image_url, image_webp"),
    fetchAll("product_images", "id, producto_id, url, url_webp"),
  ]);
  console.log(`Productos: ${productos.length} | Filas de galería: ${galeria.length}`);

  // 2. Backup del estado original (siempre, incluso en dry-run)
  const backup = {
    timestamp: new Date().toISOString(),
    productos: productos.map((p) => ({ id: p.id, image_url: p.image_url, image_webp: p.image_webp })),
    product_images: galeria.map((g) => ({ id: g.id, producto_id: g.producto_id, url: g.url, url_webp: g.url_webp })),
  };
  const backupDir = resolve(__dirname, "backups");
  mkdirSync(backupDir, { recursive: true });
  const backupFile = resolve(backupDir, `image-urls-${Date.now()}.json`);
  writeFileSync(backupFile, JSON.stringify(backup, null, 2));
  console.log(`💾 Backup guardado: ${backupFile}`);

  // 3. Recolectar referencias a migrar (solo URLs externas)
  const refs = [];
  for (const p of productos) {
    if (p.image_url && !isSupabaseUrl(p.image_url)) refs.push({ table: "productos", id: p.id, column: "image_url", url: p.image_url });
    if (p.image_webp && !isSupabaseUrl(p.image_webp)) refs.push({ table: "productos", id: p.id, column: "image_webp", url: p.image_webp });
  }
  for (const g of galeria) {
    if (g.url && !isSupabaseUrl(g.url)) refs.push({ table: "product_images", id: g.id, column: "url", url: g.url });
    if (g.url_webp && !isSupabaseUrl(g.url_webp)) refs.push({ table: "product_images", id: g.id, column: "url_webp", url: g.url_webp });
  }

  const uniqueUrls = [...new Set(refs.map((r) => r.url))];
  console.log(`Referencias externas: ${refs.length} | URLs únicas a migrar: ${uniqueUrls.length}`);

  if (uniqueUrls.length === 0) {
    console.log("✅ Nada para migrar (todas las imágenes ya están en Supabase).");
    return;
  }

  const toMigrate = uniqueUrls.slice(0, LIMIT);
  if (toMigrate.length < uniqueUrls.length) {
    console.log(`(limitado a ${toMigrate.length} URLs por --limit)`);
  }

  // 4. Descargar + subir cada URL única
  const urlMap = new Map(); // url original -> nueva url (o null si falló)
  let okCount = 0;
  let failCount = 0;

  const results = await mapLimit(toMigrate, CONCURRENCY, async (url) => {
    const dl = await download(url);
    await sleep(DELAY_BETWEEN); // pausa para no saturar los sitios de origen
    if (!dl.ok) {
      console.log(`  ✗ [${dl.status}] ${url.slice(0, 110)}`);
      return { url, newUrl: null, reason: dl.status };
    }
    const up = await uploadToBucket(dl.buf, dl.contentType, url);
    if (!up.ok) {
      console.log(`  ✗ [upload ${up.error}] ${url.slice(0, 110)}`);
      return { url, newUrl: null, reason: up.error };
    }
    console.log(`  ✓ ${url.slice(0, 110)}`);
    return { url, newUrl: up.url };
  });

  for (const r of results) {
    urlMap.set(r.url, r.newUrl);
    if (r.newUrl) okCount++;
    else failCount++;
  }

  console.log(`\nDescargas: ${okCount} OK | ${failCount} fallaron`);

  // 5. Actualizar la base (solo si no es dry-run)
  if (DRY_RUN) {
    console.log("\n🧪 DRY-RUN: no se actualizó la base. Revisá el backup y corré sin --dry-run.");
    return;
  }

  let updatedProducts = 0;
  let updatedGallery = 0;

  // productos: agrupar por id
  const prodUpdates = new Map();
  for (const r of refs) {
    if (r.table !== "productos") continue;
    const newUrl = urlMap.get(r.url);
    if (!newUrl) continue;
    if (!prodUpdates.has(r.id)) prodUpdates.set(r.id, {});
    prodUpdates.get(r.id)[r.column] = newUrl;
  }
  for (const [id, patch] of prodUpdates) {
    const { error } = await supabase.from("productos").update(patch).eq("id", id);
    if (error) console.error(`  ✗ productos ${id}: ${error.message}`);
    else updatedProducts++;
  }

  // product_images: agrupar por id
  const galUpdates = new Map();
  for (const r of refs) {
    if (r.table !== "product_images") continue;
    const newUrl = urlMap.get(r.url);
    if (!newUrl) continue;
    if (!galUpdates.has(r.id)) galUpdates.set(r.id, {});
    galUpdates.get(r.id)[r.column] = newUrl;
  }
  for (const [id, patch] of galUpdates) {
    const { error } = await supabase.from("product_images").update(patch).eq("id", id);
    if (error) console.error(`  ✗ product_images ${id}: ${error.message}`);
    else updatedGallery++;
  }

  console.log(`\n✅ Actualizados: ${updatedProducts} productos | ${updatedGallery} filas de galería`);
  console.log(`   Backup para revertir: ${backupFile}`);
  console.log(`   Para revertir: node scripts/restore-image-urls.mjs ${backupFile}`);
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});