import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function run() {
  console.log("Fetching unique groups...");
  
  const allGroups = new Set();
  const limit = 1000;
  let offset = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('productos')
      .select('grupo')
      .not('grupo', 'is', null)
      .range(offset, offset + limit - 1);
      
    if (error) {
      console.error("Error fetching products:", error);
      process.exit(1);
    }
    
    if (!data || data.length === 0) break;
    
    data.forEach(p => {
      if (p.grupo) allGroups.add(p.grupo);
    });
    
    offset += limit;
  }
  
  const uniqueGroups = [...allGroups];
  console.log(`Found ${uniqueGroups.length} unique groups.`);
  
  let count = 0;
  for (const g of uniqueGroups) {
    if (!g) continue;
    const normalized = capitalize(g.trim());
    
    if (normalized !== g) {
      const { error: updateError } = await supabase
        .from('productos')
        .update({ grupo: normalized })
        .eq('grupo', g);
        
      if (updateError) {
        console.error(`Error updating group "${g}":`, updateError);
      } else {
        count++;
        console.log(`[${count}] Normalized: "${g}" -> "${normalized}"`);
      }
    }
  }
  console.log(`\nFinished! Normalized ${count} unique groups.`);
}

run();
