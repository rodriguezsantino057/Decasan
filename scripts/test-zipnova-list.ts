/**
 * Test del listado de envíos de Zipnova (dashboard admin).
 * Compilar y correr igual que test-zipnova.ts.
 */
import { listZipnovaShipments } from "../src/lib/zipnova.ts";

async function main() {
  console.log("Listando envíos de Zipnova...\n");
  const result = await listZipnovaShipments(1, 20);

  if (!result) {
    console.log("❌ listZipnovaShipments devolvió null (sin credenciales o API falló).");
    process.exit(1);
  }

  console.log(`✅ Total: ${result.total} | Página ${result.currentPage}/${result.lastPage} | per_page ${result.perPage}`);
  console.log(`   Envíos en esta página: ${result.data.length}`);
  if (result.data.length > 0) {
    console.log("\nPrimer envío normalizado:");
    console.log(JSON.stringify(result.data[0], null, 2));
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});