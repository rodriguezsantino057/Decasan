// Test de la zona cadete y lectura de la opción desde shipping_options.
// Compilar: npx tsc src/lib/shipping.functions.ts src/integrations/supabase/client.server.ts scripts/test-cadete.ts \
//   --outDir /tmp/cadete-test --module esnext --moduleResolution bundler --target es2022 \
//   --esModuleInterop --skipLibCheck --allowImportingTsExtensions --types vite/client 2>/dev/null
// Luego: sed -i 's|@/integrations/supabase/client.server|../integrations/supabase/client.server|' /tmp/cadete-test/src/lib/shipping.functions.js
// echo '{"type":"module"}' > /tmp/cadete-test/package.json
// node --env-file=.env /tmp/cadete-test/scripts/test-cadete.js
import { isCadeteZone, getCadeteOption } from "../src/lib/shipping.functions";

async function main() {
  console.log("== isCadeteZone ==");
  console.log("5172 / La Falda      ->", isCadeteZone("5172", "La Falda"));
  console.log("5000 / Cordoba       ->", isCadeteZone("5000", "Cordoba"));
  console.log("null / Cosquin       ->", isCadeteZone(null, "Cosquin"));
  console.log("null / Buenos Aires  ->", isCadeteZone(null, "Buenos Aires"));
  console.log("9400 / null          ->", isCadeteZone("9400", null));

  console.log("\n== getCadeteOption ==");
  const enZona = await getCadeteOption("5172", "La Falda");
  console.log("5172 La Falda:", enZona ? JSON.stringify(enZona) : "null (ERROR)");
  const fuera = await getCadeteOption("5000", "Cordoba");
  console.log("5000 Cordoba:", fuera ? "presente (ERROR)" : "null (OK)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});