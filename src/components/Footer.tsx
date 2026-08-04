import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, MapPin, Phone, Mail, Clock } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-secondary text-secondary-foreground pt-16 pb-8 border-t border-secondary-foreground/10">
      <div className="container-x">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div>
            <a href="/" className="shrink-0 mb-4 inline-block">
              <img src="/logo.png" alt="Decasan" className="h-12 w-auto" />
            </a>
            <p className="text-sm text-secondary-foreground/70 leading-relaxed mb-4">
              Ferretería, herramientas y materiales en La Falda. +60 años acompañando proyectos.
            </p>
            <div className="flex gap-2">
              <a href="https://web.facebook.com/p/Decasan-Herramientas-100036108051965/?locale=es_LA&_rdc=1&_rdr" aria-label="Facebook" className="size-9 rounded-lg bg-secondary-foreground/10 flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                <Facebook className="size-4" />
              </a>
              <a href="https://www.instagram.com/decasanherramientas/" aria-label="Instagram" className="size-9 rounded-lg bg-secondary-foreground/10 flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                <Instagram className="size-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-primary">Links rápidos</h4>
            <ul className="space-y-2.5 text-sm text-secondary-foreground/80">
              <li><a href="/#inicio" className="hover:text-primary transition-colors">Inicio</a></li>
              <li><Link to="/productos" className="hover:text-primary transition-colors">Productos</Link></li>
              <li><a href="/#marcas" className="hover:text-primary transition-colors">Marcas</a></li>
              <li><Link to="/faq" className="hover:text-primary transition-colors">Nosotros</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 text-primary">Contacto</h4>
            <ul className="space-y-3 text-sm text-secondary-foreground/80">
              <li className="flex items-start gap-2"><MapPin className="size-4 text-primary shrink-0 mt-0.5" /><span>Av. Pres. Kennedy 270, La Falda, Córdoba</span></li>
              <li className="flex items-start gap-2"><Phone className="size-4 text-primary shrink-0 mt-0.5" /><a className="hover:text-primary">+54 3548 59-2127</a></li>
              <li className="flex items-start gap-2"><Mail className="size-4 text-primary shrink-0 mt-0.5" /><span>info@decasan.com.ar</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2 text-primary"><Clock className="size-4" /> Horarios</h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/80">
              <li className="flex justify-between"><span>Lun a Vie</span><span className="text-secondary-foreground">08:30 — 13:00 · 16:30 — 20:30</span></li>
              <li className="flex justify-between"><span>Sábado</span><span className="text-secondary-foreground">08:30 — 13:00 · 17:00 — 20:30</span></li>
              <li className="flex justify-between"><span>Domingo</span><span className="text-secondary-foreground/50">Cerrado</span></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-secondary-foreground/10 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-secondary-foreground/60">
          <div>© {new Date().getFullYear()} Decasan Herramientas. Todos los derechos reservados.</div>
          <div>La Falda · Córdoba · Argentina</div>
        </div>
      </div>
    </footer>
  );
}
