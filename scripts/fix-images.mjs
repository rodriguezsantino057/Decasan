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
  console.log("🛠️ INICIANDO RESTAURACIÓN DE IMÁGENES...");
  
  const images = await fetchAll("product_images", "id, producto_id, alt, url, orden");
  const prods = await fetchAll("productos", "id, nombre");
  
  const prodMap = new Map();
  const prodNamesMap = new Map();
  
  prods.forEach(p => {
     prodMap.set(p.id, p);
     if (p.nombre) prodNamesMap.set(p.nombre.toLowerCase().trim(), p.id);
  });
  
  let fixedImages = 0;
  let fixedProducts = new Set();
  
  // Vamos a procesar imagen por imagen
  for (const img of images) {
     const p = prodMap.get(img.producto_id);
     
     // Si hay una cruzada / desfasaje
     if (p && img.alt && p.nombre) {
        const altNorm = img.alt.toLowerCase().trim();
        const nomNorm = p.nombre.toLowerCase().trim();
        
        if (altNorm !== nomNorm) {
           const correctProdId = prodNamesMap.get(altNorm);
           
           if (correctProdId) {
              // 1. Mover la imagen en la galería al producto correcto
              const { error: err1 } = await supabase
                .from("product_images")
                .update({ producto_id: correctProdId })
                .eq("id", img.id);
                
              if (err1) {
                  console.error("Error moviendo imagen:", err1);
                  continue;
              }
              
              fixedImages++;
              
              // 2. Si es la imagen principal (orden 0), actualizamos la portada del producto
              if (img.orden === 0 && !fixedProducts.has(correctProdId)) {
                  await supabase
                    .from("productos")
                    .update({ image_url: img.url, image_webp: img.url })
                    .eq("id", correctProdId);
                  
                  fixedProducts.add(correctProdId);
              }
           }
        }
     }
  }
  
  console.log(`\n🎉 ¡RESTAURACIÓN COMPLETADA!`);
  console.log(`📸 Imágenes movidas a sus verdaderos dueños: ${fixedImages}`);
  console.log(`📦 Portadas de productos arregladas: ${fixedProducts.size}`);
  console.log(`\nRevisá la web, todo el sector de H. Eléctricas debería haber vuelto a la normalidad.`);
}

main();
