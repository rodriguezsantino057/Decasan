import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from("productos")
    .select("id, sku, nombre, image_url")
    .not("image_url", "is", null)
    .limit(10);
    
  console.log("=== PRODUCTOS CON IMAGEN ===");
  data.forEach(p => console.log(`ID: ${p.id} | SKU: ${p.sku} | Nombre: ${p.nombre} | Img: ${p.image_url}`));
}
main();
