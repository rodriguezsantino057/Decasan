import { createClient } from "@supabase/supabase-js";
import google from "googlethis";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Cargar variables de entorno desde .env
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan las variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
  const args = process.argv.slice(2);
  const rubro = args[0];

  if (!rubro) {
    console.log("Uso: node scripts/auto-images.mjs \"Nombre del Rubro\"");
    console.log("Ejemplo: node scripts/auto-images.mjs \"Automotor\"");
    process.exit(1);
  }

  console.log(`Buscando productos sin imagen en el rubro: "${rubro}"...`);

  // 1. Obtener productos sin imagen del rubro especificado (buscando en categoria o grupo)
  const { data: productos, error } = await supabase
    .from("productos")
    .select("id, nombre, sku, codigo_fabricante")
    .or(`categoria.ilike.%${rubro}%,grupo.ilike.%${rubro}%`)
    .is("image_url", null)
    .limit(300); // Ampliado a 300 por vez para que termine más rápido

  if (error) {
    console.error("Error al consultar productos:", error.message);
    process.exit(1);
  }

  if (!productos || productos.length === 0) {
    console.log(`¡Genial! Todos los productos de "${rubro}" ya tienen imagen (o no se encontraron productos).`);
    process.exit(0);
  }

  // 1b. Excluir productos que ya tienen imágenes en la galería (evitar duplicados)
  const ids = productos.map((p) => p.id);
  const { data: conGaleria, error: galeriaError } = await supabase
    .from("product_images")
    .select("producto_id")
    .in("producto_id", ids);
  if (galeriaError) {
    console.error("Error al consultar la galería:", galeriaError.message);
    process.exit(1);
  }
  const conGaleriaSet = new Set((conGaleria ?? []).map((g) => g.producto_id));
  const sinGaleria = productos.filter((p) => !conGaleriaSet.has(p.id));
  const omitidos = productos.length - sinGaleria.length;
  if (omitidos > 0) {
    console.log(`Se omitieron ${omitidos} productos que ya tienen imágenes en la galería.`);
  }

  if (sinGaleria.length === 0) {
    console.log(`¡Genial! Todos los productos de "${rubro}" ya tienen imagen o galería.`);
    process.exit(0);
  }

  console.log(`Se encontraron ${sinGaleria.length} productos sin imagen ni galería. Iniciando búsqueda automática...`);

  let count = 0;

  for (const p of sinGaleria) {
    const query = `${p.nombre} ${p.codigo_fabricante || ""} herramientas`.trim();
    console.log(`[${count + 1}/${sinGaleria.length}] Buscando: ${query}...`);

    try {
      const response = await fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: {
          "X-API-KEY": process.env.SERPER_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ q: query })
      });
      
      const result = await response.json();
      
      if (result.images && result.images.length > 0) {
        // Filtrar imágenes que sean HTTP y que su título coincida en gran parte con el nombre del producto
        let validImages = result.images.filter(img => {
          if (!img.imageUrl.startsWith("http")) return false;
          if (!img.title) return true;
          
          const titleWords = img.title.toLowerCase().split(/[\s-]/);
          const nameWords = p.nombre.toLowerCase().split(/[\s-]/);
          let matches = 0;
          for (const w of nameWords) {
             if (w.length > 2 && titleWords.includes(w)) matches++;
          }
          return matches >= 2 || (nameWords.length <= 2 && matches >= 1);
        });

        // ORDENAMIENTO POR NIVELES (El toque maestro)
        validImages.sort((a, b) => {
           const getScore = (img) => {
               const str = (img.link || img.source || img.imageUrl || "").toLowerCase();
               
               // Nivel 1: Páginas Oficiales
               if (str.includes("totalbusiness") || 
                   str.includes("hamilton") || 
                   str.includes("brementools") || 
                   str.includes("lusqtoff") || 
                   str.includes("milwaukeetool") || 
                   str.includes("dewalt") || 
                   str.includes("bosch")) {
                   return 1;
               }
               
               // Nivel 2: Mercado Libre
               if (str.includes("mercadolibre") || str.includes("mlstatic")) {
                   return 2;
               }
               
               // Nivel 3: Resto de internet
               return 3;
           };
           
           return getScore(a) - getScore(b); // Menor puntaje va primero (Nivel 1 > Nivel 2 > Nivel 3)
        });

        // Finalmente nos quedamos con las 3 mejores
        validImages = validImages.slice(0, 3);
        
        if (validImages.length > 0) {
          const firstImage = validImages[0];
          console.log(`  -> ¡Encontradas ${validImages.length} imágenes! Principal: ${firstImage.imageUrl}`);
          
          const { error: updateError } = await supabase
            .from("productos")
            .update({ 
              image_url: firstImage.imageUrl,
              image_webp: firstImage.imageUrl,
              erp_updated_at: new Date().toISOString()
            })
            .eq("id", p.id);

          // Agregar a la galería (product_images)
          const galleryInserts = validImages.map((img, idx) => ({
            producto_id: p.id,
            url: img.imageUrl,
            url_webp: img.imageUrl,
            alt: p.nombre,
            orden: idx
          }));

          const { error: galleryError } = await supabase
            .from("product_images")
            .insert(galleryInserts);

          if (updateError || galleryError) {
            console.error(`  -> Error al guardar:`, (updateError || galleryError).message);
          } else {
            count++;
          }
        } else {
          console.log(`  -> No se encontraron URLs válidas.`);
        }
      } else {
        console.log(`  -> No se encontraron imágenes.`);
      }
    } catch (err) {
      console.error(`  -> Error de búsqueda:`, err.message);
    }

    // Esperar 3.5 segundos para no saturar al buscador (evitar 429 Too Many Requests)
    await delay(3500);
  }

  console.log(`\n¡Proceso finalizado! Se actualizaron ${count} de ${sinGaleria.length} productos.`);
}

main();
