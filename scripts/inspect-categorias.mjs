import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: productos, error } = await supabase
    .from("productos")
    .select("categoria, grupo, nombre")
    .not("categoria", "is", null);

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  const catMap = new Map();
  const groupMap = new Map();

  for (const p of productos) {
    if (p.categoria) {
      if (!catMap.has(p.categoria)) catMap.set(p.categoria, []);
      if (catMap.get(p.categoria).length < 5) catMap.get(p.categoria).push(p.nombre);
    }
    if (p.grupo) {
      if (!groupMap.has(p.grupo)) groupMap.set(p.grupo, []);
      if (groupMap.get(p.grupo).length < 5) groupMap.get(p.grupo).push(p.nombre);
    }
  }

  console.log("=== CATEGORIAS ===");
  for (const [cat, items] of catMap.entries()) {
    console.log(`Categoría "${cat}":`);
    items.forEach(i => console.log(`  - ${i}`));
  }

  console.log("\n=== GRUPOS ===");
  for (const [grupo, items] of groupMap.entries()) {
    console.log(`Grupo "${grupo}":`);
    items.forEach(i => console.log(`  - ${i}`));
  }
}

main();
