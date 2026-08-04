import { Link } from "@tanstack/react-router";
import { ShoppingCart, MapPin, User, LogOut, Shield } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useSession, useIsAdmin, signOut } from "@/lib/auth";
import { Chatbot } from "@/components/Chatbot";
import { HeaderSearch } from "@/components/HeaderSearch";
import { Footer } from "@/components/Footer";
import type { ReactNode } from "react";

const WHATSAPP = "5493548403666";
const WA_URL = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
  "Hola Decasan, quiero hacer una consulta.",
)}`;

export function Layout({ children }: { children: ReactNode }) {
  const count = useCart((s) => s.items.reduce((a, b) => a + b.qty, 0));
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="bg-secondary text-secondary-foreground text-xs">
        <div className="container-x flex items-center justify-center sm:justify-between py-2 text-center sm:text-left">
          <span className="inline-flex items-center gap-2">
            <MapPin className="size-3.5" /> La Falda, Córdoba — Envíos a todo el país
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-surface-elevated/90 backdrop-blur">
        <div className="container-x grid grid-cols-[auto_1fr_auto] items-center gap-2 py-3 sm:flex sm:gap-4 sm:py-4">
          <Link to="/" className="shrink-0" >
              <img src="/logo.png" alt="Decasan" className="h-14 w-auto sm:h-20" />
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium ml-6">
            <Link to="/productos" className="hover:text-primary">Catálogo</Link>
            <Link to="/faq" className="hover:text-primary">Preguntas frecuentes</Link>
            {isAdmin && (
              <Link to="/admin" className="text-primary hover:text-primary/80 flex items-center gap-1">
                <Shield className="size-4" /> Admin
              </Link>
            )}
          </nav>

          <div className="order-last col-span-3 mt-2 flex justify-center sm:order-none sm:col-span-1 sm:mt-0 sm:flex-1 sm:px-2">
            <HeaderSearch />
          </div>

          <div className="flex items-center justify-end gap-0.5 sm:contents">
          {user ? (
            <>
              <Link to="/cuenta" className="p-2 hover:text-primary" aria-label="Mi cuenta">
                <User className="size-5" />
              </Link>
              <button onClick={signOut} className="p-2 hover:text-primary" aria-label="Cerrar sesión">
                <LogOut className="size-5" />
              </button>
            </>
          ) : (
            <Link to="/login" className="p-2 hover:text-primary text-sm font-medium">
              Ingresar
            </Link>
          )}
          <Link to="/carrito" className="relative p-2 hover:text-primary" aria-label="Carrito">
            <ShoppingCart className="size-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full size-4 grid place-items-center">
                {count}
              </span>
            )}
          </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <Footer />

      <Chatbot />
    </div>
  );
}
