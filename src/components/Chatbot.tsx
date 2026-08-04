import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Link } from "@tanstack/react-router";
import { chatWithBot } from "@/lib/chat.functions";

const WHATSAPP = "543548592127";
const WA_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
  "Hola Decasan, tengo una consulta a realizar.",
)}`;
const SITE_URL = "https://decasan.lovable.app";
const SAFE_LINK_HOSTS = new Set(["decasan.lovable.app", "wa.me", "www.instagram.com", "web.facebook.com"]);

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_REPLIES = [
  { label: "🔧 Buscar productos", prompt: "Quiero buscar productos en el catálogo." },
  { label: "🕒 Horarios", prompt: "¿Cuáles son los horarios de atención?" },
  { label: "🏷️ Ofertas", prompt: "¿Tienen ofertas o promociones esta semana?" },
  { label: "💬 WhatsApp", prompt: "Quiero hablar con un asesor por WhatsApp." },
];

const WELCOME: Msg = {
  role: "assistant",
  content:
    "¡Hola 👋 Soy **Decabot**, el asistente de Decasan Herramientas!\n\n¿Buscás herramientas, pinturas o materiales? Decime qué necesitás y te ayudo a encontrar el producto ideal. 🛠️",
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
      const { reply } = await sendFn({
        data: { messages: next.slice(-12) },
      });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Ups, tuve un problema para responder 😕. Probá de nuevo o escribinos por WhatsApp.",
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
          <span className="relative size-14 rounded-full bg-gradient-to-br from-primary to-primary/80 text-secondary shadow-xl grid place-items-center transition-transform group-hover:scale-105 ring-2 ring-secondary/10">
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
          className="fixed z-50 inset-0 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[380px] sm:h-[600px] sm:max-h-[80vh] flex flex-col bg-surface-elevated sm:rounded-2xl shadow-2xl border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
          role="dialog"
          aria-label="Chat con Decabot"
        >
          {/* Header */}
          <div className="bg-secondary text-secondary-foreground px-4 py-3 flex items-center gap-3 border-b border-border">
            <div className="relative">
              <div className="size-10 rounded-full bg-primary grid place-items-center text-secondary font-display text-lg">
                D
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-success ring-2 ring-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-sm tracking-wider flex items-center gap-1.5">
                Decabot <Sparkles className="size-3.5 text-primary" />
              </div>
              <div className="text-[11px] text-secondary-foreground/70">
                Asistente Decasan · En línea
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="sm:hidden p-1.5 hover:bg-white/10 rounded-md"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-surface">
            {messages.map((m, i) => (
              <Bubble key={i} msg={m} />
            ))}
            {loading && (
              <div className="flex items-end gap-2">
                <Avatar />
                <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
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
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 bg-surface">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q.label}
                  onClick={() => handleQuick(q.prompt, q.label)}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-primary hover:text-secondary hover:border-primary transition-colors font-medium"
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
              placeholder="Escribí tu consulta…"
              disabled={loading}
              maxLength={500}
              className="flex-1 h-10 px-3 rounded-full bg-muted border border-transparent focus:border-primary focus:bg-background outline-none text-sm transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="size-10 rounded-full bg-primary text-secondary grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shrink-0"
              aria-label="Enviar"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" strokeWidth={2.5} />
              )}
            </button>
          </form>
          <div className="text-[10px] text-center text-muted-foreground py-1.5 bg-surface-elevated border-t border-border">
            <Link to="/productos" className="hover:text-primary">Catálogo</Link>
            <span className="mx-2">·</span>
            <a href={WA_URL} target="_blank" rel="noreferrer" className="hover:text-primary">
              WhatsApp
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
      <div
        className={`max-w-[80%] px-4 py-2.5 text-sm shadow-sm rounded-2xl ${
          isUser
            ? "bg-primary text-secondary rounded-br-sm"
            : "bg-card text-card-foreground border border-border rounded-bl-sm"
        }`}
      >
        <div className="prose prose-sm max-w-none [&_p]:my-0 [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0.5 [&_a]:underline [&_strong]:font-semibold leading-relaxed">
          <ReactMarkdown
            components={{
              a: ({ href, children }) => (
                <a href={safeChatHref(href)} target="_blank" rel="noreferrer" className="underline">
                  {children}
                </a>
              ),
            }}
          >
            {msg.content}
          </ReactMarkdown>
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
    <div className="size-7 rounded-full bg-secondary text-primary grid place-items-center font-display text-xs shrink-0">
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
