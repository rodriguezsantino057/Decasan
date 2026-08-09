import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: productos } = await supabase.from('productos').select('id, nombre, image_url, image_webp').not('image_url', 'is', null);
  const { data: galerias } = await supabase.from('product_images').select('producto_id');
  const galleryIds = new Set(galerias.map(g => g.producto_id));
  
  const toInsert = productos.filter(p => !galleryIds.has(p.id)).map(p => ({
    producto_id: p.id,
    url: p.image_url,
    url_webp: p.image_webp || p.image_url,
    alt: p.nombre,
    orden: 0
  }));
  
  if (toInsert.length > 0) {
    const { error } = await supabase.from('product_images').insert(toInsert);
    if (error) console.error(error);
    else console.log(`Se sincronizaron ${toInsert.length} imagenes a la galeria.`);
  } else {
    console.log('Nada que sincronizar.');
  }
}
run();
