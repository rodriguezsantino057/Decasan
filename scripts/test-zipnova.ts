/**
 * Test rápido del cotizador Zipnova (usa la API real con las credenciales del .env).
 *
 * Cómo correrlo (Node 22 sin soporte TS nativo → compilar primero):
 *   npx tsc src/lib/zipnova.ts scripts/test-zipnova.ts \
 *     --outDir /tmp/zipnova-test --module commonjs --moduleResolution node \
 *     --target es2022 --esModuleInterop --skipLibCheck
 *   sed -i 's|\.\./src/lib/zipnova\.ts|../src/lib/zipnova.js|' /tmp/zipnova-test/scripts/test-zipnova.js
 *   node --env-file=.env /tmp/zipnova-test/scripts/test-zipnova.js <CP> <Provincia> <Ciudad>
 *
 * Ej:  node --env-file=.env /tmp/zipnova-test/scripts/test-zipnova.js 5000 Cordoba "Córdoba"
 *
 * Resultado esperado si funciona: costo real de 5 cifras (ej. 10757) y carrier real (OCA, Correo Argentino, etc.).
 * Si devuelve null: sin credenciales, API falló o sin opciones → el checkout solo mostrará retiro en local.
 */
import { getZipnovaQuote } from "../src/lib/zipnova.ts";

async function main() {
  const cp = process.argv[2] || "5000";
  const provincia = process.argv[3] || "Cordoba";
  const ciudad = process.argv[4] || "Córdoba";

  console.log(`Cotizando CP=${cp} provincia=${provincia} ciudad=${ciudad}...\n`);

  const result = await getZipnovaQuote(cp, 1, 1000, provincia, ciudad);

  if (!result) {
    console.log("❌ getZipnovaQuote devolvió null → NO hay tarifa (sin credenciales, API falló o sin opciones).");
    process.exit(1);
  }

  console.log("✅ Cotización obtenida:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});