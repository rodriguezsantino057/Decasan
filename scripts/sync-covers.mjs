import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fetchAll(table, columns) {
  let offset = 0;
  let limit = 1000;
  let allData = [];
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, offset + limit - 1);
    if (error) {
       console.error("Error:", error);
       process.exit(1);
    }
    if (!data || data.length === 0) break;
    allData.push(...data);
    offset += limit;
  }
  return allData;
}

async function main() {
  console.log("🛠️ FORZANDO SINCRONIZACIÓN DE PORTADAS DESDE LA GALERÍA...");
  
  // 1. Obtener toda la galería
  const images = await fetchAll("product_images", "producto_id, url");
  
  // Agrupar la primera imagen disponible para cada producto
  const productToImageMap = new Map();
  for (const img of images) {
     if (img.producto_id && !productToImageMap.has(img.producto_id)) {
        productToImageMap.set(img.producto_id, img.url);
     }
  }
  
  console.log(`Se encontraron imágenes válidas para ${productToImageMap.size} productos distintos.`);
  
  // 2. Obtener los productos que deberían tener imagen
  const prods = await fetchAll("productos", "id, nombre, image_url");
  
  let restoredCount = 0;
  const BATCH_SIZE = 50;
  let updates = [];
  
  for (const p of prods) {
     const coverUrl = productToImageMap.get(p.id);
     if (coverUrl) {
         // Si el producto no tiene portada, o su portada es distinta a la de su propia galería, lo forzamos
         if (!p.image_url || p.image_url !== coverUrl) {
             updates.push({ id: p.id, url: coverUrl });
         }
     }
  }
  
  console.log(`Hay ${updates.length} productos que tienen galería pero les falta la portada principal.`);
  console.log(`Restaurando...`);
  
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const promises = batch.map(b => 
          supabase.from("productos").update({ image_url: b.url, image_webp: b.url }).eq("id", b.id)
      );
      await Promise.all(promises);
      restoredCount += batch.length;
      process.stdout.write(`✅ Restauradas ${restoredCount}... `);
  }
  
  console.log(`\n🎉 ¡Portadas sincronizadas a la fuerza! Las amoladoras (y todo lo demás) ya deberían verse.`);
}

main();
