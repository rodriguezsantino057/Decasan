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

function cleanEnv(val?: string | null): string {
  if (!val) return "";
  return val.trim().replace(/^['"]|['"]$/g, "");
}

const BASE_URL = cleanEnv(process.env.PUBLIC_BASE_URL || process.env.VITE_PUBLIC_BASE_URL || "https://decasan.vercel.app").replace(/\/+$/, "");
const WHATSAPP_PHONE = "5493548403666";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}`;
const ALLOWED_LINK_HOSTS = new Set(["decasan.vercel.app", "decasan.com.ar", "decasan.lovable.app", "wa.me", "www.instagram.com", "web.facebook.com"]);

const SYSTEM_PROMPT = `Sos "Decabot", el asistente virtual inteligente de Decasan Herramientas, una ferretería y distribuidora de herramientas de La Falda, Córdoba con más de 60 años de trayectoria. Atendés con tono amable, cálido, profesional y bien argentino (usá "vos").

Información del local:
- Ubicación: Av. Pres. Kennedy 270, La Falda, Córdoba, Argentina.
- Horarios de atención: Lunes a viernes de 08:30 a 13:00 y de 16:30 a 20:30 hs. Sábados de 08:30 a 13:00 y de 17:00 a 20:30 hs. Domingos cerrado.
- WhatsApp de asesoramiento directo: +54 9 3548 40-3666 (${WHATSAPP_URL}).
- Medios de pago: Mercado Pago (tarjetas de crédito, débito, dinero en cuenta), Transferencia bancaria, y efectivo en el local.
- Envíos: Envíos a todo el país a través de Correo Argentino y transportes expresos. Retiro gratis en el local en La Falda.
- Web oficial: ${BASE_URL}.

Reglas de respuesta:
1. Usá el contexto de catálogo para responder con nombres, precios y marcas exactas.
2. Al citar productos usá links: [Nombre del producto](${BASE_URL}/productos/{id}).
3. Si el cliente busca asesoramiento, recomendá según el tipo de uso (hogar vs profesional) y recordá elementos de protección personal (guantes, antiparras).
4. Respuestas claras, concisas (máximo 4 a 6 líneas).`;

export const chatWithBot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const lastUserMessage = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const catalogContext = await buildCatalogContext(lastUserMessage);
    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n${catalogContext.prompt}`;

    const geminiKey = cleanEnv(process.env.GEMINI_API_KEY);
    const groqKey = cleanEnv(process.env.GROQ_API_KEY);
    const openAiKey = cleanEnv(process.env.OPENAI_API_KEY);
    const lovableKey = cleanEnv(process.env.LOVABLE_API_KEY);

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
      rawReply = buildFallbackReply(lastUserMessage, catalogContext);
    }

    return {
      reply: sanitizeReplyLinks(rawReply),
      products: catalogContext.products.slice(0, 4),
    };
  });

async function callGemini(apiKey: string, systemPrompt: string, messages: { role: string; content: string }[]): Promise<string | null> {
  try {
    const history = messages
      .filter((m) => m.role !== "system" && m.content?.trim())
      .map((m) => `${m.role === "user" ? "Cliente" : "Decabot"}: ${m.content}`)
      .join("\n\n");

    const promptText = `${systemPrompt}\n\n--- HISTORIAL DE CONVERSACIÓN ---\n${history}\n\nDecabot:`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800,
      },
    };

    for (const model of ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"]) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const json = await res.json();
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text.trim();
        } else {
          const errText = await res.text().catch(() => "");
          console.warn(`[chat] Gemini ${model} HTTP ${res.status}:`, errText.slice(0, 200));
        }
      } catch (e: any) {
        console.warn(`[chat] Gemini ${model} fetch failed:`, e?.message);
      }
    }

    return null;
  } catch (err: any) {
    console.error("[chat] callGemini exception:", err?.message);
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
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.warn(`[chat] Groq HTTP ${res.status}:`, err.slice(0, 200));
      return null;
    }

    const json = await res.json();
    return json?.choices?.[0]?.message?.content ?? null;
  } catch (err: any) {
    console.error("[chat] callGroq exception:", err?.message);
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
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.warn(`[chat] OpenAI HTTP ${res.status}:`, err.slice(0, 200));
      return null;
    }

    const json = await res.json();
    return json?.choices?.[0]?.message?.content ?? null;
  } catch (err: any) {
    console.error("[chat] callOpenAI exception:", err?.message);
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
    "hola", "buenas", "buen", "dia", "tarde", "noche", "quiero", "necesito", "busco", "tenes",
    "tienen", "para", "con", "una", "uno", "los", "las", "del", "que", "cual", "cuanto", "precio",
    "producto", "catalogo", "donde", "estan", "cuanto", "sale", "venden", "favor", "gracias", "decasan",
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

function buildFallbackReply(userQuery: string, context: { products: CatalogProduct[] }): string {
  const norm = normalizeText(userQuery);

  // 1. Saludos
  if (/^(hola|buenas|buen dia|buenas tardes|que tal|hola decabot)/.test(norm)) {
    return `¡Hola 👋! Soy **Decabot**, el asistente virtual de Decasan Herramientas.\n\n¿En qué te puedo ayudar hoy? Podés consultarme por máquinas, herramientas, medios de pago o envíos.`;
  }

  // 2. Horarios
  if (/\b(horario|horarios|atienden|abierto|hora|abren|cierran)\b/.test(norm)) {
    return `🕒 **Nuestros Horarios de Atención en el local:**\n• **Lunes a Viernes:** 08:30 a 13:00 y 16:30 a 20:30 hs.\n• **Sábados:** 08:30 a 13:00 y 17:00 a 20:30 hs.\n• **Domingos:** Cerrado.\n\n¡La tienda online está abierta las 24 hs para hacer tus compras!`;
  }

  // 3. Ubicación / Local
  if (/\b(donde|estan|ubicacion|direccion|queda|local|sucursal|calle|mapa)\b/.test(norm)) {
    return `📍 **Estamos en La Falda, Córdoba:**\nAv. Pres. Kennedy 270, La Falda.\n\nPodés retirar tus compras online gratis por nuestro local o solicitar envío a cualquier punto del país.`;
  }

  // 4. Medios de pago / Cuotas
  if (/\b(pago|pagos|tarjeta|tarjetas|cuotas|transferencia|efectivo|mercadopago|mercado pago|interes)\b/.test(norm)) {
    return `💳 **Medios de Pago Disponibles:**\n• **Mercado Pago:** Tarjetas de crédito, débito y dinero en cuenta.\n• **Transferencia bancaria** con confirmación inmediata.\n• **Efectivo** al retirar en nuestro local.\n\nTodos los pagos se procesan de forma 100% segura.`;
  }

  // 5. Envíos
  if (/\b(envio|envios|despacho|correo|argentino|costo de envio|domicilio)\b/.test(norm)) {
    return `🚚 **Envíos a todo el país:**\n• Realizamos envíos a toda la Argentina mediante **Correo Argentino** y empresas de transporte.\n• **Retiro gratis** en nuestro local de La Falda.\n\nPodés calcular el costo exacto de envío ingresando tu código postal al ver cualquier producto o en el carrito.`;
  }

  // 6. Si hay productos en el contexto
  if (context.products.length > 0) {
    const lines = context.products.slice(0, 3).map((p) => {
      const price = formatARS(getPrecioEfectivo(p));
      const saleTag = tieneOferta(p) ? " 🔥 *Oferta*" : "";
      return `• [${p.nombre ?? `Producto ${p.id}`}](${BASE_URL}/productos/${p.id}) — **${price}**${saleTag}`;
    });

    return `¡Encontré estas opciones destacadas en nuestro catálogo!\n\n${lines.join("\n")}\n\nSi necesitás asesoramiento técnico o consultar stock en el local, también podés escribirnos por [WhatsApp](${WHATSAPP_URL}).`;
  }

  // 7. Búsqueda sin coincidencias
  return `¡Hola! No encontré productos exactos en el catálogo online para esa búsqueda específica.\n\nPodés explorar todo el [Catálogo online](${BASE_URL}/productos) o consultarnos directo por [WhatsApp](${WHATSAPP_URL}) porque en el local físico disponemos de repuestos y variedad adicional.`;
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
