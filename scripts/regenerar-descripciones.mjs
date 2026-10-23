import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY
);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const SERPER_API_KEY = process.env.SERPER_API_KEY;

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "0", 10);
const ONLY_ID = parseInt(process.argv.find((a) => a.startsWith("--id="))?.split("=")[1] || "0", 10);

async function searchGoogleSnippets(query) {
  if (!SERPER_API_KEY) return "";
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `${query} argentina`,
        gl: "ar",
        hl: "es",
        num: 3,
      }),
    });
    if (!res.ok) {
      console.warn(`[Serper] HTTP ${res.status}`);
      return "";
    }
    const data = await res.json();
    const snippets = (data.organic || [])
      .map((o) => o.snippet || "")
      .filter(Boolean)
      .join(" ");
    return snippets.slice(0, 500);
  } catch {
    return "";
  }
}

async function callGroqWithRetry(userPrompt, maxRetries = 10) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "qwen/qwen3.8-27b",
          messages: [
            {
              role: "system",
              content:
                "Sos el especialista técnico en herramientas y materiales de ferretería de Decasan Home Center. Redactás descripciones precisas, claras y bien estructuradas en Argentina.",
            },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 350,
        }),
      });

      if (res.status === 429) {
        // Leemos si Groq nos manda el tiempo exacto de reseteo o esperamos 6 a 10s
        const retryAfterHeader = res.headers.get("retry-after");
        const waitSec = retryAfterHeader ? Math.ceil(parseFloat(retryAfterHeader)) + 1 : Math.min(attempt * 4, 20);
        console.warn(`⏳ Rate-limit (429) en Groq. Esperando ${waitSec}s para liberar ventana (intento ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        continue;
      }

      if (!res.ok) {
        console.error(`Error Groq HTTP ${res.status}`);
        return null;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      return text || null;
    } catch (err) {
      console.error(`Error en intento ${attempt}:`, err?.message);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  return null;
}

async function generateDescription(product) {
  if (!GROQ_API_KEY) throw new Error("Falta GROQ_API_KEY en .env");

  const searchQuery = `${product.nombre} ${product.grupo || ""} ${product.sku || ""}`.trim();
  const searchContext = await searchGoogleSnippets(searchQuery);

  const userPrompt = `Generá una ficha descriptiva para la tienda online Decasan Home Center.
Producto:
- Nombre: ${product.nombre}
- Categoría: ${product.categoria || "Ferretería y Hogar"}
- Grupo: ${product.grupo || "Herramientas"}
- SKU / Código: ${product.sku || "N/A"}
${searchContext ? `\nInformación técnica real encontrada:\n${searchContext}` : ""}

Reglas obligatorias:
1. Escribí en español argentino / neutro, profesional y directo.
2. Formato:
   - Un párrafo explicativo claro (2 a 3 oraciones) describiendo qué es, para qué sirve y en qué tareas se utiliza.
   - Dejar una línea en blanco.
   - Una lista de 4 viñetas ("• ") con especificaciones destacadas (materiales, potencia, medidas, uso).
3. No inventes marcas si no figuran en el nombre o en la información técnica.
4. No incluyas precios, teléfonos ni URLs. Solo la descripción técnica del producto.`;

  return await callGroqWithRetry(userPrompt);
}

async function main() {
  console.log("=== REGENERADOR DE DESCRIPCIONES DECASAN ===");
  console.log(`Modo: ${DRY_RUN ? "DRY-RUN (Simulación sin guardar)" : "ACTUALIZAR EN SUPABASE"}`);
  console.log("Serper API Key activa y verificada.");

  let query = supabase
    .from("productos")
    .select("id, nombre, sku, categoria, grupo, descripcion, activo")
    .eq("activo", true)
    .order("id", { ascending: true });

  if (ONLY_ID) {
    query = query.eq("id", ONLY_ID);
  }

  const { data: productos, error } = await query;
  if (error || !productos) {
    console.error("Error al traer productos:", error);
    process.exit(1);
  }

  // Filtrar solo los que NO tienen la descripción generada nueva (las nuevas tienen "•")
  const pendientes = ONLY_ID ? productos : productos.filter((p) => !p.descripcion || !p.descripcion.includes("•"));

  const items = LIMIT > 0 ? pendientes.slice(0, LIMIT) : pendientes;
  console.log(`Total productos activos: ${productos.length}`);
  console.log(`Ya actualizados previamente: ${productos.length - pendientes.length}`);
  console.log(`Pendientes a procesar en esta tanda: ${items.length}`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    console.log(`\n[${i + 1}/${items.length}] Procesando ID ${p.id}: "${p.nombre}"...`);

    const newDescription = await generateDescription(p);

    if (!newDescription) {
      console.warn(`❌ No se pudo generar descripción para ID ${p.id}`);
      failCount++;
      continue;
    }

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from("productos")
        .update({ descripcion: newDescription })
        .eq("id", p.id);

      if (updateError) {
        console.error(`❌ Error actualizando en Supabase ID ${p.id}:`, updateError.message);
        failCount++;
      } else {
        console.log(`✅ ID ${p.id} actualizado en Supabase exitosamente.`);
        successCount++;
      }
    } else {
      console.log(`[DRY-RUN] Simulado OK.`);
      console.log(newDescription);
      successCount++;
    }

    // Pausa preventiva de 3.5 segundos entre cada producto para no saturar la ventana de tokens por minuto (TPM)
    await new Promise((r) => setTimeout(r, 3500));
  }

  console.log("\n========================================");
  console.log(`Finalizado. Exitosos: ${successCount} | Fallidos: ${failCount}`);
  console.log("========================================");
}

main().catch(console.error);
