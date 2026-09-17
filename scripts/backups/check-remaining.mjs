import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../.env") });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const external = (u) => u && !String(u).includes("supabase.co/storage");

async function externalCount(table, colsStr) {
  let n = 0;
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(colsStr)
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) for (const c of colsStr.split(",")) if (external(row[c])) n++;
    offset += limit;
  }
  return n;
}

const prod = await externalCount("productos", "id,image_url,image_webp");
const gal = await externalCount("product_images", "id,url,url_webp");
console.log(`Quedan con URL externa -> productos: ${prod} | product_images: ${gal}`);

const { count, error } = await supabase
  .from("productos")
  .select("id", { count: "exact", head: true });
if (error) console.error("err:", error.message);
else console.log("Total productos:", count);
const { count: c2 } = await supabase
  .from("product_images")
  .select("id", { count: "exact", head: true });
console.log("Total product_images:", c2);
