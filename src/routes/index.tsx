import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Truck, ShieldCheck, Headphones, Store } from "lucide-react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { Brands } from "@/components/Brands";
import { InstagramReels } from "@/components/InstagramReels";
import { LocationSection } from "@/components/LocationSection";
import { fetchProductos, fetchCategorias } from "@/lib/products";
import { useSession, useIsAdmin } from "@/lib/auth";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import heroImg from "@/assets/hero.jpg";
import heroHome from "@/assets/hero-home.png";
import heroConstruction from "@/assets/hero-construction.png";
import heroGarden from "@/assets/hero-garden.png";
import heroPlumbing from "@/assets/hero-plumbing.png";
import catAccesorios from "@/assets/cat-accesorios.png";
import catAutomotor from "@/assets/cat-automotor.png";
import catBateria from "@/assets/cat-bateria.png";
import catElectricas from "@/assets/cat-electricas.png";
import catSanitarios from "@/assets/cat-sanitarios.png";
import catJardin from "@/assets/cat-jardin.png";
import catMateriales from "@/assets/cat-materiales.png";
import catElectricos from "@/assets/cat-materiales-electricos.png";

const CATEGORY_IMAGES: Record<string, string> = {
  "accesorios y herramientas": catAccesorios,
  "automotor": catAutomotor,
  "bateria": catBateria,
  "h. eléctricas": catElectricas,
  "sanitarios e instalaciones": catSanitarios,
  "jardín": catJardin,
  "materiales": catMateriales,
  "materiales eléctricos": catElectricos,
};
export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user);

  const [emblaRef] = useEmblaCarousel({ loop: true, duration: 40 }, [
    Autoplay({ delay: 5000, stopOnInteraction: false }),
  ]);

  const featured = useQuery({
    queryKey: ["featured", isAdmin],
    queryFn: () => fetchProductos({ limit: 8, isAdmin }),
  });
  const cats = useQuery({ queryKey: ["cats", isAdmin], queryFn: () => fetchCategorias(isAdmin) });

  const slides = [
    {
      src: heroHome,
      title: "Hogar y Decoración",
      desc: "Renová cada espacio de tu casa con diseño, equipamiento y calidad.",
      btn1: { text: "Catálogo Hogar", cat: "Hogar" },
      btn2: { text: "Sanitarios", cat: "Sanitarios e instalaciones" },
    },
    {
      src: heroConstruction,
      title: "Construcción y Materiales",
      desc: "Todo lo necesario para proyectos sólidos desde los cimientos.",
      btn1: { text: "Materiales", cat: "Materiales" },
      btn2: { text: "Herramientas", cat: "Accesorios y Herramientas" },
    },
    {
      src: heroPlumbing,
      title: "Sanitarios e Instalaciones",
      desc: "Grifería, loza sanitaria y todo tipo de caños para tu proyecto.",
      btn1: { text: "Ver Sanitarios", cat: "Sanitarios e instalaciones" },
      btn2: { text: "Herramientas", cat: "Accesorios y Herramientas" },
    },
    {
      src: heroGarden,
      title: "Jardín y Aire Libre",
      desc: "Disfrutá del exterior con nuestras plantas, herramientas y equipamiento.",
      btn1: { text: "Todo para Jardín", cat: "Jardín" },
      btn2: { text: "Herramientas Eléctricas", cat: "H. Eléctricas" },
    },
  ];

  return (
    <Layout>
      {/* HERO CAROUSEL */}
      <section id="inicio" className="relative bg-secondary text-secondary-foreground overflow-hidden scroll-mt-28">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {slides.map((slide, index) => (
              <div className="relative flex-[0_0_100%] min-w-0" key={index}>
                <img
                  src={slide.src}
                  alt={slide.title}
                  className="absolute inset-0 size-full object-cover opacity-40 object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-secondary/90 via-secondary/70 to-transparent" />
                <div className="container-x relative py-20 md:py-32 max-w-3xl">
                  <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-primary font-medium mb-6 animate-fade-in-down">
                    <span className="size-1.5 bg-primary" /> Decasan Home Center
                  </div>
                  <h1 className="font-display text-4xl md:text-6xl lg:text-7xl leading-[0.95] animate-fade-in-up animate-delay-100">
                    <span className="text-primary">{slide.title}.</span>
                  </h1>
                  <p className="mt-6 text-base md:text-lg text-secondary-foreground/90 max-w-xl animate-fade-in-up animate-delay-200">
                    {slide.desc}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3 animate-fade-in-up animate-delay-300">
                    <Link
                      to="/productos"
                      search={{ cat: slide.btn1.cat } as never}
                      className="inline-flex items-center gap-2 bg-primary text-foreground font-display tracking-wide px-6 py-3 hover:bg-primary/90 transition"
                    >
                      {slide.btn1.text} <ArrowRight className="size-4" />
                    </Link>
                    <Link
                      to="/productos"
                      search={{ cat: slide.btn2.cat } as never}
                      className="inline-flex items-center gap-2 border border-white/20 px-6 py-3 font-display tracking-wide hover:border-primary hover:text-primary transition"
                    >
                      {slide.btn2.text}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
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
          {(cats.data ?? []).map((c, idx) => {
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
