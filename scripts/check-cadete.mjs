// Verifica el estado real de la tabla shipping_options.
// Uso: node --env-file=.env scripts/check-cadete.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}

const client = createClient(url, key);
const { data, error } = await client
  .from("shipping_options")
  .select("id, transportista, provincia, costo, label, activo, dias_estimados_min, dias_estimados_max")
  .order("transportista")
  .order("provincia", { nullsFirst: true });

if (error) {
  console.error("Error:", error.message);
  process.exit(1);
}

console.log("Total filas:", data.length);
for (const row of data) {
  console.log(
    `- ${row.transportista.padEnd(16)} | ${String(row.provincia ?? "TODAS").padEnd(12)} | $${row.costo} | activo=${row.activo} | dias=${row.dias_estimados_min}-${row.dias_estimados_max} | ${row.label}`
  );
}

const cadete = data.find((r) => r.transportista === "cadete");
console.log("\nCadete encontrado:", cadete ? "SI" : "NO");
console.log("Correo Argentino filas:", data.filter((r) => r.transportista === "correo_argentino").length);
console.log("Andreani filas:", data.filter((r) => r.transportista === "andreani").length);