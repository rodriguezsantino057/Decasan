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
  console.log("🔍 Analizando cruces de imágenes en TODA la base de datos...");
  const images = await fetchAll("product_images", "id, producto_id, alt, url");
  const prods = await fetchAll("productos", "id, nombre, sku");
  
  const prodMap = new Map(); // id -> product
  const prodNamesMap = new Map(); // name.toLowerCase -> id
  
  prods.forEach(p => {
     prodMap.set(p.id, p);
     if (p.nombre) prodNamesMap.set(p.nombre.toLowerCase().trim(), p.id);
  });
  
  let mismatches = 0;
  let fixable = 0;
  
  for (const img of images) {
     const p = prodMap.get(img.producto_id);
     if (p && img.alt && p.nombre) {
        const altNorm = img.alt.toLowerCase().trim();
        const nomNorm = p.nombre.toLowerCase().trim();
        
        // Si hay desfasaje
        if (altNorm !== nomNorm) {
           mismatches++;
           
           // Buscar si el producto verdadero (el de la foto) existe con otro ID
           if (prodNamesMap.has(altNorm)) {
              fixable++;
           }
        }
     }
  }
  
  console.log(`\n🚨 RESULTADOS:`);
  console.log(`Total de imágenes cruzadas/desfasadas: ${mismatches}`);
  console.log(`De las cuales se pueden REPARAR automáticamente: ${fixable}`);
  
  if (fixable > 0) {
     console.log(`\nEl sistema ERP actualizó los nombres de los productos y eso desfasó los IDs.`);
     console.log(`Podemos usar el texto original de la imagen para re-asignarlas a los IDs correctos.`);
  }
}

main();
