import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Truck, ShieldCheck, Headphones, Store } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { Brands } from "@/components/Brands";
import { InstagramReels } from "@/components/InstagramReels";
import { LocationSection } from "@/components/LocationSection";
import { fetchProductos, fetchCategorias } from "@/lib/products";
import { isNumericCategory } from "@/lib/categories";
import { useSession, useIsAdmin } from "@/lib/auth";
import heroConstruction from "@/assets/hero-construction.png";
import heroPlumbing from "@/assets/hero-plumbing.png";
import catAccesorios from "@/assets/cat-accesorios.jpg";
import catAutomotor from "@/assets/cat-automotor.jpg";
import catElectricas from "@/assets/cat-electricas.jpg";
import catSanitarios from "@/assets/cat-sanitarios.jpg";
import catJardin from "@/assets/cat-jardin.jpg";
import catMateriales from "@/assets/cat-materiales.jpg";
import catElectricos from "@/assets/cat-materiales-electricos.jpg";

const CATEGORY_IMAGES: Record<string, string> = {
  "accesorios y herramientas": catAccesorios,
  "automotor": catAutomotor,
  "h. eléctricas": catElectricas,
  "h. electricas": catElectricas,
  "herramientas eléctricas": catElectricas,
  "sanitarios e instalaciones": catSanitarios,
  "sanitarios": catSanitarios,
  "jardín": catJardin,
  "jardin": catJardin,
  "materiales": catMateriales,
  "materiales eléctricos": catElectricos,
  "materiales electricos": catElectricos,
};
export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user);

  const featured = useQuery({
    queryKey: ["featured", isAdmin],
    queryFn: () => fetchProductos({ limit: 8, isAdmin }),
  });
  const cats = useQuery({ queryKey: ["cats"], queryFn: () => fetchCategorias() });
  const displayedCategories = (cats.data ?? []).filter((c) => !isNumericCategory(c));

  return (
    <Layout>
      {/* HOMECENTER BENTO GRID HERO */}
      <section id="inicio" className="bg-secondary text-secondary-foreground py-6 md:py-10 scroll-mt-28">
        <div className="container-x">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
            
            {/* PANEL PRINCIPAL (8 COLS) - Soluciones y proyectos integrales */}
            <div className="lg:col-span-8 relative rounded-2xl overflow-hidden min-h-[420px] md:min-h-[500px] flex flex-col justify-end p-6 md:p-12 border border-white/10 shadow-2xl group">
              <img
                src={heroConstruction}
                alt="Decasan Homecenter"
                className="absolute inset-0 size-full object-cover object-center group-hover:scale-105 transition-transform duration-700 brightness-75"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/70 to-secondary/20" />
              
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold tracking-wider uppercase mb-4 backdrop-blur-md">
                  <span className="size-2 rounded-full bg-primary animate-pulse" /> Decasan Homecenter
                </div>
                
                <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight">
                  Construcción, herramientas e instalaciones para <span className="text-primary">todo tu proyecto.</span>
                </h1>
                
                <p className="mt-4 text-sm sm:text-base text-secondary-foreground/80 max-w-lg leading-relaxed">
                  Línea completa para profesionales, gremio y particulares. Marcas líderes, asesoramiento técnico en La Falda y envíos a todo el país.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    to="/productos"
                    className="inline-flex items-center gap-2 bg-primary text-foreground font-display font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition shadow-lg shadow-primary/20"
                  >
                    Explorar Catálogo <ArrowRight className="size-4" />
                  </Link>
                  <Link
                    to="/productos"
                    search={{ cat: "Accesorios y Herramientas" } as never}
                    className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-display px-5 py-3 rounded-lg transition backdrop-blur-sm"
                  >
                    Herramientas Pro
                  </Link>
                </div>
              </div>
            </div>

            {/* PANELES LATERALES (4 COLS BENTO) */}
            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-6">
              
              {/* Tarjeta 1: Sanitarios & Instalaciones */}
              <Link
                to="/productos"
                search={{ cat: "Sanitarios e instalaciones" } as never}
                className="relative rounded-2xl overflow-hidden p-6 flex flex-col justify-between min-h-[200px] border border-white/10 shadow-lg group hover:border-primary/50 transition-all duration-300"
              >
                <img
                  src={heroPlumbing}
                  alt="Sanitarios e Instalaciones"
                  className="absolute inset-0 size-full object-cover object-center group-hover:scale-105 transition-transform duration-500 brightness-[0.65]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-secondary via-secondary/60 to-transparent" />
                
                <div className="relative z-10 flex justify-between items-start">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
                    Especialidad
                  </span>
                  <div className="size-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-primary group-hover:text-foreground transition-colors">
                    <ArrowRight className="size-4 -rotate-45 group-hover:rotate-0 transition-transform" />
                  </div>
                </div>

                <div className="relative z-10 mt-6">
                  <h3 className="font-display text-xl font-bold text-white group-hover:text-primary transition-colors">
                    Sanitarios e Instalaciones
                  </h3>
                  <p className="text-xs text-white/70 mt-1 line-clamp-2">
                    Griferías, termofusión, loza y conexiones hidráulicas completas.
                  </p>
                </div>
              </Link>

              {/* Tarjeta 2: Venta Corporativa, Obras y Gremio */}
              <div
                className="relative rounded-2xl overflow-hidden p-6 flex flex-col justify-between min-h-[200px] bg-gradient-to-br from-surface-elevated via-secondary to-secondary border border-border shadow-lg group"
              >
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    Atención a Obras
                  </span>
                  <Store className="size-6 text-primary shrink-0 opacity-80" />
                </div>

                <div className="mt-4">
                  <h3 className="font-display text-lg font-bold text-foreground">
                    Presupuestos para Profesionales
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Precios especiales por volumen, acopio de materiales y cotización directa por WhatsApp.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-semibold text-primary">
                  <a
                    href="https://wa.me/5493548545800?text=Hola%20Decasan,%20quiero%20solicitar%20presupuesto%20para%20una%20obra"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 hover:underline"
                  >
                    Cotizar por WhatsApp <ArrowRight className="size-3.5" />
                  </a>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>


      {/* trust strip */}
      <section className="border-b border-border bg-surface">
        <div className="container-x grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          {[
            { icon: Truck, t: "Envíos a todo el país", s: "Logística nacional" },
            { icon: Store, t: "Retiro en local", s: "La Falda, Córdoba" },
            { icon: ShieldCheck, t: "Pago seguro", s: "Mercado Pago" },
            { icon: Headphones, t: "Asesoramiento", s: "WhatsApp directo" },
          ].map(({ icon: Icon, t, s }, idx) => (
            <div key={t} className={`bg-surface p-5 flex items-center gap-3 animate-fade-in-up animate-delay-${idx * 100}`}>
              <Icon className="size-6 text-primary shrink-0" strokeWidth={1.5} />
              <div>
                <div className="font-display text-sm">{t}</div>
                <div className="text-xs text-muted-foreground">{s}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* categories */}
      <section className="container-x py-16">
        <div className="flex items-end justify-between mb-8 animate-fade-in-up animate-delay-400">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-black mb-2">Categorías</div>
            <h2 className="font-display text-3xl md:text-4xl">Explorá por rubro</h2>
          </div>
          <Link to="/productos" className="text-sm font-medium hover:text-primary hidden sm:block">
            Ver todo →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {displayedCategories.map((c, idx) => {
            const bgImg = CATEGORY_IMAGES[c.toLowerCase()];
            return (
              <Link
                key={c}
                to="/productos"
                search={{ cat: c } as never}
                className={`group relative bg-secondary text-white p-6 h-36 flex items-end overflow-hidden border-l-2 border-primary transition animate-fade-in-up animate-delay-${(idx + 5) * 100}`}
              >
                {bgImg ? (
                  <>
                    <img src={bgImg} alt={c} className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 group-hover:from-black/80 transition-colors duration-300" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-secondary group-hover:bg-primary transition-colors duration-300" />
                )}
                <div className="font-display text-lg leading-tight relative z-10">{c}</div>
                <div className="absolute top-3 right-3 text-[10px] uppercase tracking-wider opacity-50 group-hover:opacity-100 z-10">
                  Ver →
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* brands */}
      <Brands />

      {/* featured */}
      <section className="container-x py-16">
        <div className="flex items-end justify-between mb-8 animate-fade-in-up animate-delay-600">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-black mb-2">Destacados</div>
            <h2 className="font-display text-3xl md:text-4xl">Más vendidos</h2>
          </div>
          <Link to="/productos" className="text-sm font-medium hover:text-primary hidden sm:block">
            Ver catálogo →
          </Link>
        </div>
        {featured.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`aspect-[3/4] bg-muted animate-pulse animate-fade-in animate-delay-${i * 100}`} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(featured.data?.items ?? []).map((p, idx) => (
              <div key={p.id} className={`animate-fade-in-up animate-delay-${(idx + 7) * 100}`}>
                <ProductCard p={p} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* INSTAGRAM REELS SECTION */}
      <InstagramReels />

      {/* LOCATION SECTION */}
      <LocationSection />
    </Layout>
  );
}
