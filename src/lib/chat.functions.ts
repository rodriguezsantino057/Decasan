import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_CATEGORIES, normalizeCategoryName } from "@/lib/categories";
import { getPrecioEfectivo } from "@/lib/products";
import { formatARS } from "@/lib/format";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
});

type CatalogProduct = {
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
};

const BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.VITE_PUBLIC_BASE_URL || "https://decasan.com.ar").replace(/\/+$/, "");
const WHATSAPP_URL = "https://wa.me/5493548403666";
const ALLOWED_LINK_HOSTS = new Set(["decasan.com.ar", "decasan.lovable.app", "wa.me", "www.instagram.com", "web.facebook.com"]);

const SYSTEM_PROMPT = `Sos "Decabot", el asistente virtual de Decasan Herramientas, una ferreteria de La Falda, Cordoba con mas de 60 anos de trayectoria. Atendes a clientes con tono amable, cercano y profesional, en espanol rioplatense (usa "vos").

Informacion fija del local:
- Ubicacion: Av. Pres. Kennedy 270, La Falda, Cordoba, Argentina.
- Horario: lunes a viernes 08:30-13:00 y 16:30-20:30. Sabados 08:30-13:00 y 17:00-20:30. Domingos cerrado.
- WhatsApp: +54 9 3548 40-3666 (${WHATSAPP_URL}).
- Envios a todo el pais y retiro en local.
- Sitio valido: ${BASE_URL}. Nunca uses decasan.com ni dominios inventados.

Reglas de catalogo:
- Usa primero la informacion de "CONTEXTO DE CATALOGO" que recibe cada consulta.
- Si recomendas productos, usa solo productos listados en el contexto. No inventes precio, stock, marca ni link.
- Para linkear productos usa solo /productos/{id} o ${BASE_URL}/productos/{id}.
- Para busquedas generales usa /productos o ${BASE_URL}/productos.
- Si no hay productos relevantes, explicalo y pedi mas detalle o deriva a WhatsApp.

Conocimiento de herramientas y maquinas:
- Ayuda a elegir segun uso, material, potencia, diametro, medidas, accesorios, seguridad, frecuencia de trabajo y presupuesto.
- Diferencia uso hogareno, profesional e industrial.
- Sugeri EPP cuando corresponda (anteojos, guantes, proteccion auditiva, mascara).
- Si la consulta implica electricidad, gas, altura, soldadura, corte o presion, agrega una advertencia breve de seguridad.

Estilo:
- Respuestas breves (max 6-8 lineas), claras, con bullets si ayuda.
- Pregunta 1 cosa concreta si faltan datos para recomendar bien.
- Se honesto: si no sabes o no esta en catalogo, decilo.`;

export const chatWithBot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const lastUserMessage = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const catalogContext = await buildCatalogContext(lastUserMessage);

    let apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { reply: buildFallbackReply(catalogContext) };
    }

    let url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    let model = "google/gemini-3-flash-preview";

    if (process.env.OPENAI_API_KEY) {
      url = "https://api.openai.com/v1/chat/completions";
      model = "gpt-4o-mini";
    } else if (process.env.GEMINI_API_KEY) {
      url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      model = "gemini-1.5-flash";
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: catalogContext.prompt },
          ...data.messages,
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return { reply: "Estoy recibiendo muchas consultas en este momento. Probá de nuevo en unos segundos o escribinos por WhatsApp." };
      }
      if (res.status === 402) {
        return { reply: buildFallbackReply(catalogContext) };
      }
      const text = await res.text().catch(() => "");
      throw new Error(`AI Gateway error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const reply: string =
      json?.choices?.[0]?.message?.content ??
      "No pude generar una respuesta. ¿Podés reformular la pregunta?";
    return { reply: sanitizeReplyLinks(reply) };
  });

async function buildCatalogContext(query: string) {
  const terms = extractSearchTerms(query);
  const category = detectCategory(query);
  const products = await searchCatalogProducts(terms, category);

  const productLines = products.map((p) => {
    const price = formatARS(getPrecioEfectivo(p));
    const stock = Number(p.stock ?? 0) > 0 ? `stock ${p.stock}` : "sin stock informado";
    const categoryLabel = p.categoria ? `categoria ${p.categoria}` : "sin categoria";
    const group = p.grupo ? `marca/grupo ${p.grupo}` : "sin marca/grupo";
    return `- ID ${p.id}: ${p.nombre ?? "Producto"} | SKU ${p.sku ?? "-"} | ${price} | ${stock} | ${categoryLabel} | ${group} | link ${BASE_URL}/productos/${p.id}`;
  });

  const prompt = `CONTEXTO DE CATALOGO ACTUAL
Categorias validas: ${DEFAULT_CATEGORIES.join(", ")}
Categoria detectada: ${category ?? "ninguna"}
Productos relevantes encontrados (${products.length}):
${productLines.length ? productLines.join("\n") : "- No se encontraron productos relevantes para esta consulta."}

Recordatorio: solo podes citar/linkear productos de esta lista. Si no alcanza, pedi mas informacion o deriva a WhatsApp ${WHATSAPP_URL}.`;

  return { products, prompt };
}

async function searchCatalogProducts(terms: string[], category: string | null): Promise<CatalogProduct[]> {
  let query = supabaseAdmin
    .from("productos")
    .select("id,nombre,descripcion,categoria,grupo,sku,precio,precio_oferta,oferta_hasta,stock")
    .eq("activo", true)
    .order("stock", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(8);

  if (category) query = query.eq("categoria", category);

  const search = terms.slice(0, 5).join(" ").trim();
  if (search) {
    const safe = search.replace(/[%,()]/g, " ").trim();
    if (safe) {
      query = query.or(
        `nombre.ilike.%${safe}%,categoria.ilike.%${safe}%,grupo.ilike.%${safe}%,descripcion.ilike.%${safe}%,sku.ilike.%${safe}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("[chat] catalog search failed", error.message);
    return [];
  }
  return (data ?? []) as CatalogProduct[];
}

function extractSearchTerms(input: string): string[] {
  const stopwords = new Set([
    "hola",
    "buenas",
    "quiero",
    "necesito",
    "busco",
    "tenes",
    "tienen",
    "para",
    "con",
    "una",
    "uno",
    "los",
    "las",
    "del",
    "que",
    "cual",
    "cuanto",
    "precio",
    "producto",
    "catalogo",
  ]);

  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.-]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3 && !stopwords.has(term));
}

function detectCategory(input: string): string | null {
  const normalized = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (/\b(jardin|manguera|riego|poda|cesped|desmalezadora)\b/.test(normalized)) return "Jardín";
  if (/\b(sanitario|canilla|griferia|bano|agua|instalacion|termofusion)\b/.test(normalized)) return "Sanitarios e instalaciones";
  if (/\b(bateria|inalambric|cargador|litio)\b/.test(normalized)) return "Bateria";
  if (/\b(electrica|taladro|amoladora|sierra|lijadora|rotomartillo)\b/.test(normalized)) return "H. Eléctricas";
  if (/\b(auto|automotor|bujia|aceite|gato|llave cruz)\b/.test(normalized)) return "Automotor";
  if (/\b(cemento|arena|cal|ladrillo|material)\b/.test(normalized)) return "Materiales";
  if (/\b(accesorio|herramienta|destornillador|pinza|llave|martillo)\b/.test(normalized)) return "Accesorios y Herramientas";

  return normalizeCategoryName(input);
}

function buildFallbackReply(context: { products: CatalogProduct[] }) {
  if (context.products.length === 0) {
    return `Puedo ayudarte, pero no encontré productos exactos en el catálogo con esa consulta.\n\nContame marca, medida o uso que le vas a dar, o mirá el catálogo: [Ver productos](${BASE_URL}/productos).`;
  }

  const lines = context.products.slice(0, 3).map((p) => {
    return `- [${p.nombre ?? `Producto ${p.id}`}](${BASE_URL}/productos/${p.id}) - ${formatARS(getPrecioEfectivo(p))}`;
  });

  return `Encontré estas opciones en el catálogo:\n${lines.join("\n")}\n\nSi me decís el uso y presupuesto, te ayudo a elegir la más conveniente.`;
}

function sanitizeReplyLinks(reply: string): string {
  return reply.replace(/\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g, (full, href: string) => {
    const safe = sanitizeHref(href);
    return safe ? full.replace(href, safe) : "](https://decasan.lovable.app/productos)";
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
    if (url.hostname === "decasan.lovable.app") {
      if (url.pathname === "/productos" || url.pathname === "/productos/") return `${BASE_URL}/productos`;
      if (/^\/productos\/\d+$/.test(url.pathname)) return `${BASE_URL}${url.pathname}`;
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
