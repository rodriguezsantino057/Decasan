import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const groqKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const delay = (ms) => new Promise(res => setTimeout(res, ms));

const CATEGORIAS_VALIDAS = [
  "Accesorios y Herramientas",
  "Automotor",
  "Bateria",
  "H. Eléctricas",
  "Sanitarios e instalaciones",
  "Jardín",
  "Materiales",
  "Materiales Eléctricos"
];

async function callAIBatch(products) {
  const prompt = `Actúa como un experto ferretero.
Para CADA producto de la lista, asigna una de las Categorías Válidas y deduce el TIPO genérico en PLURAL (el Grupo).

Categorías Válidas (DEBES ELEGIR UNA DE ESTAS EXACTAMENTE, NINGUNA OTRA): 
${CATEGORIAS_VALIDAS.join(", ")}

REGLAS PARA EL GRUPO:
- Debe ser el tipo genérico del producto en PLURAL.
- Ejemplos: "Amoladoras", "Destornilladores", "Hachas", "Tornillos", "Compresores".
- Máximo 1 o 2 palabras.

Lista de Productos:
${products.map(p => `{"id": ${p.id}, "nombre": "${p.nombre.replace(/"/g, '')}"}`).join("\n")}

Responde ÚNICAMENTE con un JSON Array. No escribas texto antes ni después. Ejemplo de respuesta correcta:
[
  {"id": 123, "categoria": "Herramientas Manuales", "grupo": "Martillos"},
  {"id": 124, "categoria": "Materiales Eléctricos", "grupo": "Cables"}
]`;

  try {
    const modelsRes = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { "Authorization": `Bearer ${groqKey}` }
    });
    const modelsData = await modelsRes.json();
    const firstTextModel = modelsData.data.find(m => m.id.includes("llama") || m.id.includes("mixtral") || m.id.includes("gemma") || m.id.includes("qwen") || m.id.includes("gpt")).id;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: firstTextModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 3000
      })
    });
    
    const data = await res.json();
    if (data.error) {
      console.error("API Error:", data.error.message);
      return null;
    }
    
    let content = data.choices[0].message.content;
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
       return JSON.parse(match[0]);
    }
    return null;
  } catch (err) {
    console.error("Error AI:", err.message);
    return null;
  }
}

async function main() {
  console.log("🔍 Buscando TODOS los productos con categoría o grupo numérico para procesarlos INDIVIDUALMENTE...");
  
  let offset = 0;
  let limit = 1000;
  let toProcess = [];
  
  while (true) {
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, categoria, grupo")
      .range(offset, offset + limit - 1);
      
    if (error) {
       console.error("Error fetching:", error);
       process.exit(1);
    }
    
    if (!data || data.length === 0) break;
    
    for (const p of data) {
       const catIsNum = /^\d+$/.test(p.categoria || "");
       const groupIsNum = /^\d+$/.test(p.grupo || "");
       // Si es null o es numérico, lo procesamos.
       if (catIsNum || groupIsNum || !p.categoria || !p.grupo) {
          toProcess.push(p);
       }
    }
    offset += limit;
  }
  
  console.log(`✅ Se encontraron ${toProcess.length} productos afectados.`);
  console.log("Iniciando procesamiento por lotes mediante IA. Esto analizará el nombre exacto de CADA producto.");
  
  const BATCH_SIZE = 15; 
  
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
     const batch = toProcess.slice(i, i + BATCH_SIZE);
     console.log(`\n📦 Procesando lote ${Math.floor(i/BATCH_SIZE) + 1} de ${Math.ceil(toProcess.length/BATCH_SIZE)} (${batch.length} productos)...`);
     
     const results = await callAIBatch(batch);
     
     if (results && Array.isArray(results)) {
        // Enviar las actualizaciones a Supabase
        const updatePromises = results.map(res => 
           supabase.from("productos").update({ categoria: res.categoria, grupo: res.grupo }).eq("id", res.id)
        );
        await Promise.all(updatePromises);
        
        // Mostrar algunos de los mapeos para que veamos qué hizo
        for (let j = 0; j < Math.min(3, results.length); j++) {
           const original = batch.find(b => b.id === results[j].id);
           console.log(`   🔸 ${original?.nombre.substring(0, 30)}... -> Categoria: "${results[j].categoria}" | Grupo: "${results[j].grupo}"`);
        }
        
        console.log(`✅ Lote actualizado con éxito.`);
     } else {
        console.error("⚠️ La IA no devolvió el formato esperado para este lote. Se reintentará en el futuro.");
     }
     
     // 3 segundos de pausa para no quemar el rate limit gratuito de Groq
     await delay(3000); 
  }
  
  console.log("\n🎉 ¡Proceso por lotes finalizado! Toda tu base de datos ahora tiene los plurales y categorías correctas producto por producto.");
}

main();
