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

  // 1. Obtener productos sin imagen del rubro o grupo
  const { data: productos, error } = await supabase
    .from("productos")
    .select("id, nombre, sku, codigo_fabricante")
    .or(`categoria.ilike.%${rubro}%,grupo.ilike.%${rubro}%`)
    .is("image_url", null)
    .limit(50); // Límite de 50 por vez para no saturar

  if (error) {
    console.error("Error al consultar productos:", error.message);
    process.exit(1);
  }

  if (!productos || productos.length === 0) {
    console.log(`¡Genial! Todos los productos de "${rubro}" ya tienen imagen (o no se encontraron productos).`);
    process.exit(0);
  }

  console.log(`Se encontraron ${productos.length} productos sin imagen. Iniciando búsqueda automática...`);

  let count = 0;

  for (const p of productos) {
    const query = `${p.nombre} ${p.codigo_fabricante || ""} herramientas`.trim();
    console.log(`[${count + 1}/${productos.length}] Buscando: ${query}...`);

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
        const validImages = result.images.filter(img => img.imageUrl.startsWith("http")).slice(0, 3);
        
        if (validImages.length > 0) {
          const firstImage = validImages[0];
          console.log(`  -> ¡Encontradas ${validImages.length} imágenes! Principal: ${firstImage.imageUrl}`);
          
          const { error: updateError } = await supabase
            .from("productos")
            .update({ 
              image_url: firstImage.imageUrl,
              image_webp: firstImage.imageUrl
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

  console.log(`\n¡Proceso finalizado! Se actualizaron ${count} de ${productos.length} productos.`);
}

main();
