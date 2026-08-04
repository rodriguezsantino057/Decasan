import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Loader2, Sparkles, ExternalLink, ShoppingBag, PhoneCall } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link } from "@tanstack/react-router";
import { chatWithBot, type CatalogProduct } from "@/lib/chat.functions";
import { ProductImage } from "@/components/ProductImage";
import { formatARS } from "@/lib/format";
import { getPrecioEfectivo, tieneOferta } from "@/lib/products";

const WHATSAPP_PHONE = "5493548403666";
const WA_URL = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
  "Hola Decasan, tengo una consulta a realizar.",
)}`;
const SITE_URL = "https://decasan.vercel.app";
const SAFE_LINK_HOSTS = new Set(["decasan.vercel.app", "decasan.lovable.app", "decasan.com.ar", "wa.me", "www.instagram.com", "web.facebook.com"]);

type Msg = {
  role: "user" | "assistant";
  content: string;
  products?: CatalogProduct[];
};

const QUICK_REPLIES = [
  { label: "🔍 Buscar herramientas", prompt: "Quiero buscar herramientas en el catálogo." },
  { label: "📍 Ubicación y horarios", prompt: "¿Dónde están ubicados y cuáles son los horarios de atención?" },
  { label: "💳 Medios de pago", prompt: "¿Qué medios de pago y tarjetas aceptan?" },
  { label: "🚚 Envíos y retiros", prompt: "¿Cómo son los envíos y cuánto tardan?" },
  { label: "🏷️ Ofertas destacadas", prompt: "¿Cuáles son las ofertas o promociones de la semana?" },
  { label: "💬 Hablar por WhatsApp", prompt: "Quiero hablar con un asesor por WhatsApp." },
];

const WELCOME: Msg = {
  role: "assistant",
  content:
    "¡Hola 👋! Soy **Decabot**, el asesor virtual de Decasan Herramientas.\n\n¿Buscás alguna máquina, herramienta o presupuesto? Decime qué necesitás y te ayudo a encontrar la mejor opción.",
};

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sendFn = useServerFn(chatWithBot);

  useEffect(() => {
    if (open) {
      setUnread(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { reply, products } = await sendFn({
        data: {
          messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        },
      });
      setMessages((m) => [...m, { role: "assistant", content: reply, products }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Ups, tuve una pequeña interrupción en la conexión 😕. Podés probar de nuevo o escribirnos directamente por WhatsApp.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleQuick(prompt: string, label: string) {
    if (label.includes("WhatsApp")) {
      window.open(WA_URL, "_blank", "noopener");
      return;
    }
    send(prompt);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar chat" : "Abrir chat"}
        className="fixed bottom-5 right-5 z-50 group"
      >
        <span className="relative flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping opacity-60" />
          <span className="relative size-14 rounded-full bg-gradient-to-br from-primary to-primary/85 text-secondary shadow-xl grid place-items-center transition-transform group-hover:scale-105 ring-2 ring-secondary/10">
            {open ? (
              <X className="size-6" strokeWidth={2.5} />
            ) : (
              <MessageCircle className="size-6" strokeWidth={2.5} />
            )}
          </span>
          {!open && unread && (
            <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </span>
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed z-50 inset-0 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[410px] sm:h-[620px] sm:max-h-[82vh] flex flex-col bg-surface-elevated sm:rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
          role="dialog"
          aria-label="Chat con Decabot"
        >
          {/* Header */}
          <div className="bg-secondary text-secondary-foreground px-4 py-3.5 flex items-center gap-3 border-b border-border shadow-sm">
            <div className="relative">
              <div className="size-10 rounded-full bg-primary grid place-items-center text-secondary font-display text-lg shadow-inner">
                D
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-sm tracking-wider flex items-center gap-1.5 font-bold">
                Decabot <Sparkles className="size-3.5 text-primary animate-pulse" />
              </div>
              <div className="text-[11px] text-secondary-foreground/75 flex items-center gap-1">
                <span>Asesor Decasan</span>
                <span>•</span>
                <span className="text-emerald-400 font-medium">Online</span>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 hover:bg-white/10 rounded-lg text-secondary-foreground/80 hover:text-white transition-colors"
              aria-label="Cerrar chat"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-surface scroll-smooth">
            {messages.map((m, i) => (
              <Bubble key={i} msg={m} />
            ))}
            {loading && (
              <div className="flex items-end gap-2 animate-in fade-in">
                <Avatar />
                <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5 items-center">
                    <Dot delay="0ms" />
                    <Dot delay="150ms" />
                    <Dot delay="300ms" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick replies */}
          {messages.length <= 2 && !loading && (
            <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-surface border-t border-border/40">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q.label}
                  onClick={() => handleQuick(q.prompt, q.label)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-card/90 hover:bg-primary hover:text-secondary hover:border-primary transition-all font-medium text-foreground/90 shadow-2xs"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border bg-surface-elevated p-3 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí tu consulta sobre herramientas…"
              disabled={loading}
              maxLength={500}
              className="flex-1 h-10 px-3.5 rounded-full bg-muted border border-transparent focus:border-primary focus:bg-background outline-none text-sm transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="size-10 rounded-full bg-primary text-secondary grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-all shadow-sm shrink-0"
              aria-label="Enviar mensaje"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" strokeWidth={2.5} />
              )}
            </button>
          </form>

          {/* Bottom Bar */}
          <div className="text-[11px] text-center text-muted-foreground py-2 bg-surface-elevated border-t border-border flex items-center justify-center gap-3">
            <Link to="/productos" className="hover:text-primary transition-colors flex items-center gap-1 font-medium">
              <ShoppingBag className="size-3" /> Ver catálogo
            </Link>
            <span className="text-border">•</span>
            <a
              href={WA_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-500 transition-colors flex items-center gap-1 font-medium"
            >
              <PhoneCall className="size-3" /> WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-end" : ""}`}>
      {!isUser && <Avatar />}
      <div className={`space-y-2 max-w-[85%] ${isUser ? "ml-auto" : ""}`}>
        <div
          className={`px-4 py-2.5 text-sm shadow-sm rounded-2xl ${
            isUser
              ? "bg-primary text-secondary rounded-br-sm font-medium"
              : "bg-card text-card-foreground border border-border rounded-bl-sm"
          }`}
        >
          <div className="prose prose-sm max-w-none [&_p]:my-0.5 [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0.5 [&_a]:text-primary [&_a]:font-semibold [&_a]:underline [&_strong]:font-semibold leading-relaxed">
            <ReactMarkdown
              components={{
                a: ({ href, children }) => (
                  <a href={safeChatHref(href)} target="_blank" rel="noreferrer" className="underline hover:opacity-80">
                    {children}
                  </a>
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* Product preview cards */}
        {!isUser && msg.products && msg.products.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Productos sugeridos
            </div>
            <div className="grid grid-cols-1 gap-2">
              {msg.products.map((product) => (
                <MiniProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniProductCard({ product }: { product: CatalogProduct }) {
  const effectivePrice = getPrecioEfectivo(product);
  const onSale = tieneOferta(product);
  const inStock = Number(product.stock ?? 0) > 0;
  const waProductUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
    `Hola Decasan, me interesa consultar por el producto: ${product.nombre ?? ""} (ID #${product.id}). ¿Tienen stock disponible?`,
  )}`;

  return (
    <div className="bg-card border border-border rounded-xl p-2.5 flex gap-3 shadow-2xs hover:border-primary/50 transition-colors">
      <div className="size-16 rounded-lg bg-surface border border-border overflow-hidden shrink-0 grid place-items-center">
        <ProductImage
          src={product.image_url}
          webp={product.image_webp}
          alt={product.nombre ?? "Producto"}
          className="size-full object-cover"
          iconClassName="size-8 text-muted-foreground/40"
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {product.grupo && (
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block truncate">
              {product.grupo}
            </span>
          )}
          <Link
            to="/productos/$id"
            params={{ id: String(product.id) }}
            className="text-xs font-semibold hover:text-primary transition-colors line-clamp-1 text-foreground"
          >
            {product.nombre}
          </Link>
        </div>

        <div className="flex items-center justify-between gap-1 pt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-bold text-primary">
              {formatARS(effectivePrice)}
            </span>
            {onSale && (
              <span className="text-[9px] bg-red-500/15 text-red-600 font-bold px-1 rounded">
                Oferta
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Link
              to="/productos/$id"
              params={{ id: String(product.id) }}
              className="text-[11px] bg-primary/10 hover:bg-primary hover:text-secondary text-primary font-medium px-2 py-0.5 rounded-md transition-colors flex items-center gap-1"
            >
              Ver <ExternalLink className="size-2.5" />
            </Link>
            <a
              href={waProductUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Consultar por WhatsApp"
              className="text-[11px] bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-600 font-medium px-2 py-0.5 rounded-md transition-colors"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function safeChatHref(href: string | undefined): string {
  if (!href) return `${SITE_URL}/productos`;
  if (href.startsWith("/productos")) return `${SITE_URL}${href}`;
  try {
    const url = new URL(href);
    if (SAFE_LINK_HOSTS.has(url.hostname)) return url.toString();
  } catch {
    return `${SITE_URL}/productos`;
  }
  return `${SITE_URL}/productos`;
}

function Avatar() {
  return (
    <div className="size-7 rounded-full bg-secondary text-primary grid place-items-center font-display text-xs font-bold shrink-0 shadow-2xs">
      D
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-2 rounded-full bg-muted-foreground/60 animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}
