// Inspecciona categorias y grupos reales de productos.
// Uso: node --env-file=.env scripts/check-grupos.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(url, key);

const { data, error } = await client
  .from("productos")
  .select("categoria, grupo")
  .eq("activo", true);

if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

const cats = new Map();
const grupos = new Map();
for (const row of data) {
  const c = row.categoria?.trim() || "(sin categoria)";
  const g = row.grupo?.trim() || "(sin grupo)";
  cats.set(c, (cats.get(c) ?? 0) + 1);
  grupos.set(g, (grupos.get(g) ?? 0) + 1);
}

console.log("=== CATEGORIAS ===");
for (const [k, v] of [...cats.entries()].sort((a, b) => b[1] - a[1])) console.log(`${String(v).padStart(4)}  ${k}`);
console.log("\n=== GRUPOS ===");
for (const [k, v] of [...grupos.entries()].sort((a, b) => b[1] - a[1])) console.log(`${String(v).padStart(4)}  ${k}`);

// Buscar productos con "taladro" en nombre o grupo o categoria
console.log("\n=== PRODUCTOS con 'taladr' ===");
const { data: taladros } = await client
  .from("productos")
  .select("id, nombre, categoria, grupo")
  .eq("activo", true)
  .or("nombre.ilike.%taladr%,grupo.ilike.%taladr%,categoria.ilike.%taladr%")
  .limit(10);
for (const t of taladros ?? []) console.log(`- ${t.id} | ${t.nombre} | cat=${t.categoria} | grupo=${t.grupo}`);