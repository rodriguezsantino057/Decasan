import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_CATEGORIES, normalizeCategoryName } from "@/lib/categories";
import { getPrecioEfectivo, tieneOferta } from "@/lib/products";
import { formatARS } from "@/lib/format";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
});

export type CatalogProduct = {
  id: number;
  nombre: string | null;
  descripcion: string | null;
  categoria: string | null;
  grupo: string | null;
  sku: string | null;
  precio: number | null;
  precio_oferta: number | null;
  oferta_hasta: string | null;
  stock: number | null;
  image_url?: string | null;
  image_webp?: string | null;
};

const BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.VITE_PUBLIC_BASE_URL || "https://decasan.vercel.app").replace(/\/+$/, "");
const WHATSAPP_PHONE = "5493548403666";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}`;
const ALLOWED_LINK_HOSTS = new Set(["decasan.vercel.app", "decasan.com.ar", "decasan.lovable.app", "wa.me", "www.instagram.com", "web.facebook.com"]);

const SYSTEM_PROMPT = `Sos "Decabot", el asistente virtual inteligente de Decasan Herramientas, una ferretería y distribuidora de herramientas de La Falda, Córdoba con más de 60 años de trayectoria. Atendés con tono amable, cálido, profesional y bien argentino (usá "vos").

Información del negocio:
- Ubicación: Av. Pres. Kennedy 270, La Falda, Córdoba, Argentina.
- Horarios de atención: Lunes a viernes de 08:30 a 13:00 y de 16:30 a 20:30 hs. Sábados de 08:30 a 13:00 y de 17:00 a 20:30 hs. Domingos cerrado.
- WhatsApp de asesoramiento directo: +54 9 3548 40-3666 (${WHATSAPP_URL}).
- Medios de pago: Mercado Pago (tarjetas de crédito, débito, dinero en cuenta), Transferencia bancaria, y efectivo en el local.
- Envíos: Envíos a todo el país a través de Correo Argentino y transportes expresos. Retiro gratis en el local en La Falda.
- Web oficial: ${BASE_URL}.

Reglas de atención al cliente y catálogo:
1. Usá la información de "CONTEXTO DE CATALOGO ACTUAL" adjunta en el prompt para responder con precisión.
2. Al recomendar productos, usá ÚNICAMENTE los productos listados en el contexto con sus precios, nombres y marcas reales. No inventes precios ni stock.
3. Para colocar links a productos usa siempre el formato [Nombre del producto](${BASE_URL}/productos/{id}).
4. Si el cliente busca una categoría o variedad general, invitalo a ver el catálogo completo: [Ver catálogo](${BASE_URL}/productos).
5. Si no hay productos que coincidan exactamente con lo que busca, sé sincero, explicale amablemente y recomendale consultar por WhatsApp (${WHATSAPP_URL}) porque en el local físico suele haber más variedad y repuestos.
6. Asesoramiento técnico: Ayudá al cliente diferenciando uso hogareño/hobby vs. profesional/industrial. Recordá sugerir elementos de protección personal (EPP) cuando corresponda (guantes, antiparras, protección auditiva).
7. Mantené las respuestas concisas (máximo 4 a 6 líneas), claras y con viñetas si hay varias opciones.`;

export const chatWithBot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const lastUserMessage = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const catalogContext = await buildCatalogContext(lastUserMessage);
    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n${catalogContext.prompt}`;

    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const groqKey = process.env.GROQ_API_KEY?.trim();
    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    const lovableKey = process.env.LOVABLE_API_KEY?.trim();

    let rawReply: string | null = null;

    if (geminiKey) {
      rawReply = await callGemini(geminiKey, fullSystemPrompt, data.messages);
    } else if (groqKey) {
      rawReply = await callGroq(groqKey, fullSystemPrompt, data.messages);
    } else if (openAiKey) {
      rawReply = await callOpenAI(openAiKey, fullSystemPrompt, data.messages);
    } else if (lovableKey) {
      rawReply = await callLovableGateway(lovableKey, fullSystemPrompt, data.messages);
    }

    if (!rawReply) {
      rawReply = buildFallbackReply(catalogContext);
    }

    return {
      reply: sanitizeReplyLinks(rawReply),
      products: catalogContext.products.slice(0, 4),
    };
  });

async function callGemini(apiKey: string, systemPrompt: string, messages: { role: string; content: string }[]): Promise<string | null> {
  try {
    const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];

    for (const m of messages) {
      if (m.role === "system") continue;
      const role: "user" | "model" = m.role === "user" ? "user" : "model";
      const text = m.content?.trim();
      if (!text) continue;

      const last = contents[contents.length - 1];
      if (last && last.role === role) {
        last.parts[0].text += `\n${text}`;
      } else {
        contents.push({
          role,
          parts: [{ text }],
        });
      }
    }

    if (contents.length > 0 && contents[0].role !== "user") {
      contents.shift();
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: contents.length > 0 ? contents : [{ role: "user" as const, parts: [{ text: "Hola" }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 900,
      },
    };

    // Try Gemini 2.0 Flash, then fallback to 1.5 Flash if needed
    for (const model of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        const output = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (output) return output;
      } else {
        const errText = await res.text().catch(() => "");
        console.warn(`[chat] Gemini (${model}) HTTP ${res.status}:`, errText.slice(0, 300));
      }
    }

    return null;
  } catch (err: any) {
    console.error("[chat] Gemini call exception:", err?.message);
    return null;
  }
}

async function callGroq(apiKey: string, systemPrompt: string, messages: { role: string; content: string }[]): Promise<string | null> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.filter((m) => m.role !== "system"),
        ],
        temperature: 0.3,
        max_tokens: 900,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[chat] Groq HTTP ${res.status}:`, errText.slice(0, 300));
      return null;
    }

    const json = await res.json();
    return json?.choices?.[0]?.message?.content ?? null;
  } catch (err: any) {
    console.error("[chat] Groq call exception:", err?.message);
    return null;
  }
}

async function callOpenAI(apiKey: string, systemPrompt: string, messages: { role: string; content: string }[]): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.filter((m) => m.role !== "system"),
        ],
        temperature: 0.3,
        max_tokens: 900,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn(`[chat] OpenAI HTTP ${res.status}:`, errText.slice(0, 300));
      return null;
    }

    const json = await res.json();
    return json?.choices?.[0]?.message?.content ?? null;
  } catch (err: any) {
    console.error("[chat] OpenAI call exception:", err?.message);
    return null;
  }
}

async function callLovableGateway(apiKey: string, systemPrompt: string, messages: { role: string; content: string }[]): Promise<string | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.filter((m) => m.role !== "system"),
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function buildCatalogContext(query: string) {
  const terms = extractSearchTerms(query);
  const category = detectCategory(query);
  const products = await searchCatalogProducts(terms, category);

  const productLines = products.map((p) => {
    const price = formatARS(getPrecioEfectivo(p));
    const saleInfo = tieneOferta(p) ? " (EN OFERTA)" : "";
    const stock = Number(p.stock ?? 0) > 0 ? `stock disponible (${p.stock} u.)` : "consultar disponibilidad";
    const categoryLabel = p.categoria ? `categoría: ${p.categoria}` : "";
    const brand = p.grupo ? `marca: ${p.grupo}` : "";
    return `- ID ${p.id}: "${p.nombre ?? "Producto"}" | ${brand} | ${categoryLabel} | ${price}${saleInfo} | ${stock} | link: ${BASE_URL}/productos/${p.id}`;
  });

  const prompt = `CONTEXTO DE CATALOGO ACTUAL
Categorías de la tienda: ${DEFAULT_CATEGORIES.join(", ")}
Categoría identificada en la consulta: ${category ?? "ninguna específica"}
Productos relevantes encontrados en la base de datos (${products.length}):
${productLines.length ? productLines.join("\n") : "- No se encontraron productos coincidentes en la base de datos."}

Recordatorio: Solo podés citar o recomendar productos que figuren en esta lista con su respectivo link. Si no hay productos, ofrecé asesoramiento por WhatsApp.`;

  return { products, prompt };
}

async function searchCatalogProducts(terms: string[], category: string | null): Promise<CatalogProduct[]> {
  try {
    let query = supabaseAdmin
      .from("productos")
      .select("id,nombre,descripcion,categoria,grupo,sku,precio,precio_oferta,oferta_hasta,stock,image_url,image_webp")
      .eq("activo", true)
      .limit(60);

    if (category) {
      query = query.eq("categoria", category);
    }

    if (terms.length > 0) {
      const searchClauses = terms.flatMap((term) => {
        const safe = term.replace(/[%,()]/g, " ").trim();
        if (!safe) return [];
        return [
          `nombre.ilike.%${safe}%`,
          `grupo.ilike.%${safe}%`,
          `categoria.ilike.%${safe}%`,
          `descripcion.ilike.%${safe}%`,
          `sku.ilike.%${safe}%`,
        ];
      });

      if (searchClauses.length > 0) {
        query = query.or(searchClauses.join(","));
      }
    } else if (!category) {
      query = query.order("stock", { ascending: false, nullsFirst: false }).limit(8);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[chat] catalog search query error", error.message);
      return [];
    }

    const rows = (data ?? []) as CatalogProduct[];
    if (terms.length === 0) return rows.slice(0, 8);

    const ranked = rows
      .map((item) => ({ item, score: scoreProductMatch(item, terms) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.item.stock ?? 0) - Number(a.item.stock ?? 0));

    return ranked.slice(0, 8).map((entry) => entry.item);
  } catch (err: any) {
    console.error("[chat] searchCatalogProducts exception", err?.message);
    return [];
  }
}

function scoreProductMatch(product: CatalogProduct, tokens: string[]): number {
  const name = normalizeText(product.nombre);
  const sku = normalizeText(product.sku);
  const group = normalizeText(product.grupo);
  const category = normalizeText(product.categoria);
  const desc = normalizeText(product.descripcion);
  let total = 0;

  for (const token of tokens) {
    let tokenScore = 0;
    if (name === token) tokenScore = Math.max(tokenScore, 1000);
    else if (name.split(" ").some((w) => w === token)) tokenScore = Math.max(tokenScore, 800);
    else if (name.includes(token)) tokenScore = Math.max(tokenScore, 500);

    if (group.includes(token)) tokenScore = Math.max(tokenScore, 400);
    if (sku === token || sku.includes(token)) tokenScore = Math.max(tokenScore, 350);
    if (category.includes(token)) tokenScore = Math.max(tokenScore, 200);
    if (desc.includes(token)) tokenScore = Math.max(tokenScore, 100);

    total += tokenScore;
  }

  if (tokens.length > 1 && name.includes(tokens.join(" "))) {
    total += 500;
  }

  return total;
}

function normalizeText(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractSearchTerms(input: string): string[] {
  const stopwords = new Set([
    "hola", "buenas", "quiero", "necesito", "busco", "tenes", "tienen", "para", "con", "una",
    "uno", "los", "las", "del", "que", "cual", "cuanto", "precio", "producto", "catalogo",
    "donde", "estan", "cuanto", "sale", "venden", "favor", "gracias", "decasan",
  ]);

  return normalizeText(input)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !stopwords.has(term));
}

function detectCategory(input: string): string | null {
  const normalized = normalizeText(input);

  if (/\b(jardin|manguera|riego|poda|cesped|desmalezadora|cortadora)\b/.test(normalized)) return "Jardín";
  if (/\b(sanitario|canilla|griferia|bano|agua|instalacion|termofusion|valvula|plomeria)\b/.test(normalized)) return "Sanitarios e instalaciones";
  if (/\b(bateria|inalambric|cargador|litio|20v|18v|12v)\b/.test(normalized)) return "Bateria";
  if (/\b(electrica|taladro|amoladora|sierra|lijadora|rotomartillo|sensitiva|soldadora|lustradora)\b/.test(normalized)) return "H. Eléctricas";
  if (/\b(auto|automotor|bujia|aceite|gato|llave cruz|compresor)\b/.test(normalized)) return "Automotor";
  if (/\b(cemento|arena|cal|ladrillo|material|adhesivo|sellador|membrana)\b/.test(normalized)) return "Materiales";
  if (/\b(accesorio|herramienta|destornillador|pinza|llave|martillo|disco|mecha|bocallave)\b/.test(normalized)) return "Accesorios y Herramientas";

  return normalizeCategoryName(input);
}

function buildFallbackReply(context: { products: CatalogProduct[] }): string {
  if (context.products.length === 0) {
    return `¡Hola! No encontré productos exactos en el catálogo para esa búsqueda.\n\nPodés contarme qué trabajo necesitás realizar o ver todo nuestro [Catálogo online](${BASE_URL}/productos). También podés consultarnos directo por [WhatsApp](${WHATSAPP_URL}) para verificar stock en el local.`;
  }

  const lines = context.products.slice(0, 3).map((p) => {
    const price = formatARS(getPrecioEfectivo(p));
    const saleTag = tieneOferta(p) ? " 🔥 *Oferta*" : "";
    return `• [${p.nombre ?? `Producto ${p.id}`}](${BASE_URL}/productos/${p.id}) — **${price}**${saleTag}`;
  });

  return `¡Hola! Encontré estas opciones destacadas en nuestro catálogo:\n\n${lines.join("\n")}\n\nSi necesitás asesoramiento sobre cuál se adapta mejor a tu trabajo o presupuesto, ¡decime y te ayudo!`;
}

function sanitizeReplyLinks(reply: string): string {
  return reply.replace(/\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g, (full, href: string) => {
    const safe = sanitizeHref(href);
    return safe ? full.replace(href, safe) : `](${BASE_URL}/productos)`;
  });
}

function sanitizeHref(href: string): string | null {
  if (href.startsWith("/")) {
    if (href === "/productos" || href === "/productos/") return `${BASE_URL}/productos`;
    if (/^\/productos\/\d+$/.test(href)) return `${BASE_URL}${href}`;
    return null;
  }

  try {
    const url = new URL(href);
    if (!ALLOWED_LINK_HOSTS.has(url.hostname)) return null;
    if (url.hostname === "decasan.lovable.app" || url.hostname === "decasan.vercel.app" || url.hostname === "decasan.com.ar") {
      if (url.pathname === "/productos" || url.pathname === "/productos/") return `${BASE_URL}/productos`;
      if (/^\/productos\/\d+$/.test(url.pathname)) return `${BASE_URL}${url.pathname}`;
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
