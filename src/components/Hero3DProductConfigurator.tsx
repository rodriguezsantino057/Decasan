import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

interface HeroGroup {
  id: string;
  grupoQuery?: string;
  catQuery?: string;
  badge: string;
  titleTop: string;
  titleMain: string;
  shortDesc: string;
  buttonText: string;
  image: string;
  itemCount: number;
  startingPrice: string;
  quote: string;
  subcategories: string[];
}

const GROUPS: HeroGroup[] = [
  {
    id: "taladros",
    grupoQuery: "Taladros",
    badge: "LÍNEA PERFORACIÓN",
    titleTop: "Taladros y Percutores",
    titleMain: "Potencia para cada obra.",
    shortDesc: "Inalámbricos, percutores y de banco. Desde 12V hasta motores industriales con maletín y accesorios completos.",
    buttonText: "Ver todos los taladros",
    image: "/images/hero-tools/taladro.webp",
    itemCount: 109,
    startingPrice: "Desde $ 2.969",
    quote: "Herramientas de perforación que responden en cada desafío.",
    subcategories: ["Percutores", "Inalámbricos", "De Pie", "Mechas"],
  },
  {
    id: "amoladoras",
    grupoQuery: "Amoladoras",
    badge: "CORTE & DESBASTE",
    titleTop: "Amoladoras Angulares",
    titleMain: "Corte limpio y seguro.",
    shortDesc: "Líneas de 4½'', 7'' y 9'' para metal, chapa y mampostería. Arranque progresivo y máxima durabilidad de motor.",
    buttonText: "Ver todas las amoladoras",
    image: "/images/hero-tools/amoladora.webp",
    itemCount: 92,
    startingPrice: "Desde $ 1.233",
    quote: "La fuerza necesaria para los trabajos de herrería y taller.",
    subcategories: ["4½ Pulgadas", "7 Pulgadas", "9 Pulgadas", "Discos"],
  },
  {
    id: "rotomartillos",
    grupoQuery: "Rotomartillos",
    badge: "DEMOLICIÓN & HORMIGÓN",
    titleTop: "Rotomartillos SDS",
    titleMain: "Fuerza de impacto sin límite.",
    shortDesc: "Encastre SDS-Plus y SDS-Max para demolición y perforación pesada. Sistemas antivibración para jornadas intensas.",
    buttonText: "Ver todos los rotomartillos",
    image: "/images/hero-tools/rotomartillo.webp",
    itemCount: 30,
    startingPrice: "Desde $ 12.922",
    quote: "Impacto neumático calibrado para la exigencia de obra.",
    subcategories: ["SDS-Plus", "SDS-Max", "Demolidores", "Cinceles"],
  },
  {
    id: "compresores",
    grupoQuery: "Compresores",
    badge: "AIRE & NEUMÁTICA",
    titleTop: "Compresores de Aire",
    titleMain: "Presión constante y caudal.",
    shortDesc: "Equipos monofásicos y trifásicos desde 24L hasta 200L. Ideales para gomerías, pintura soplete y herramientas neumáticas.",
    buttonText: "Ver todos los compresores",
    image: "/images/hero-tools/compresor.webp",
    itemCount: 55,
    startingPrice: "Desde $ 11.658",
    quote: "Rendimiento neumático continuo para tu taller o industria.",
    subcategories: ["24 Litros", "50 Litros", "100 Litros", "Accesorios"],
  },
  {
    id: "herramientas-manuales",
    catQuery: "Accesorios y Herramientas",
    badge: "HERRAMIENTAS MANUALES",
    titleTop: "Herramientas Manuales",
    titleMain: "Precisión y resistencia en mano.",
    shortDesc: "Llaves, pinzas, destornilladores, martillos, sets de tubos y accesorios esenciales para todo tipo de reparación y taller.",
    buttonText: "Ver todas las herramientas manuales",
    image: "/images/hero-tools/caja-herramientas.webp",
    itemCount: 84,
    startingPrice: "Desde $ 8.900",
    quote: "La base de cualquier trabajo bien hecho empieza en tus manos.",
    subcategories: ["Llaves y Tubos", "Pinzas", "Destornilladores", "Sets de Taller"],
  },
];

export function Hero3DProductConfigurator() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [isAnimating, setIsAnimating] = useState(false);

  // Efecto de inclinación 3D suave con el cursor
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const group = GROUPS[activeIndex];
  const nextIndex = (activeIndex + 1) % GROUPS.length;
  const nextGroup = GROUPS[nextIndex];

  useEffect(() => {
    setTilt({ x: 0, y: 0 });
  }, [activeIndex]);

  // Precachear todas las imágenes WebP del carrusel en background para que el cambio de slide sea instantáneo
  useEffect(() => {
    GROUPS.forEach((g) => {
      const img = new Image();
      img.src = g.image;
    });
  }, []);

  // Autoplay cada 10 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setDirection("next");
      setIsAnimating(true);
      setActiveIndex((prev) => (prev < GROUPS.length - 1 ? prev + 1 : 0));
      setTimeout(() => setIsAnimating(false), 500);
    }, 10000);

    return () => clearInterval(timer);
  }, [activeIndex]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -(y * 12), y: x * 16 });
  }

  function handleMouseLeave() {
    setTilt({ x: 0, y: 0 });
  }

  function goPrev() {
    if (isAnimating) return;
    setDirection("prev");
    setIsAnimating(true);
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : GROUPS.length - 1));
    setTimeout(() => setIsAnimating(false), 500);
  }

  function goNext() {
    if (isAnimating) return;
    setDirection("next");
    setIsAnimating(true);
    setActiveIndex((prev) => (prev < GROUPS.length - 1 ? prev + 1 : 0));
    setTimeout(() => setIsAnimating(false), 500);
  }

  return (
    <section className="relative w-full overflow-hidden bg-background">
      {/* FULL WIDTH: Amarillo Decasan oficial (#ffd83b / #f6c800) */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative w-full min-h-[540px] md:min-h-[620px] flex flex-col justify-between px-6 sm:px-12 md:px-16 lg:px-20 py-8 md:py-12 select-none overflow-hidden transition-all duration-300"
        style={{
          background: "radial-gradient(ellipse at 50% 30%, #ffd83b 0%, #f6c800 45%, #e5b600 75%, #cca000 100%)",
        }}
      >


        {/* CUERPO CENTRAL: 2 COLUMNAS (TEXTO A LA IZQUIERDA Y PRODUCTO PROTAGONISTA AL CENTRO/DERECHA) */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center my-auto py-2 sm:py-4">

          {/* LADO IZQUIERDO (5 COLS): Título del grupo y enlace directo al catálogo */}
          <div
            key={`left-${group.id}`}
            className={`lg:col-span-5 text-center lg:text-left order-2 lg:order-1 flex flex-col items-center lg:items-start transition-all duration-500 ease-out ${
              direction === "next"
                ? "animate-in fade-in slide-in-from-left-6"
                : "animate-in fade-in slide-in-from-right-6"
            }`}
          >
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-black leading-[1.08] sm:leading-[1.02] tracking-tight">
              {group.titleTop} <br />
              <span className="text-black/85">{group.titleMain}</span>
            </h2>

            <p className="mt-3 sm:mt-5 text-xs sm:text-sm md:text-base text-black/80 max-w-md leading-relaxed font-medium">
              {group.shortDesc}
            </p>

            <div className="mt-5 sm:mt-8">
              <Link
                to="/productos"
                search={
                  (group.catQuery
                    ? { cat: group.catQuery }
                    : { grupo: group.grupoQuery }) as never
                }
                className="inline-flex items-center gap-2 bg-black text-white hover:bg-black/85 active:scale-95 px-6 sm:px-8 py-3 sm:py-4 rounded-full font-display text-xs sm:text-sm font-bold shadow-xl transition-all"
              >
                {group.buttonText} <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* CENTRO / DERECHA (7 COLS): IMAGEN PROTAGÓNICA DEL PRODUCTO CON INCLINACIÓN 3D Y SOMBRA */}
          <div
            className="lg:col-span-7 relative flex items-center justify-center order-1 lg:order-2 my-1 sm:my-2 lg:my-0 select-none"
            style={{ perspective: 1000 }}
          >
            {/* Resplandor blanco sutil detrás de la herramienta para realce sin lavar el amarillo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[500px] md:w-[600px] max-w-[95vw] h-[260px] sm:h-[360px] md:h-[400px] bg-white/25 blur-[90px] rounded-full pointer-events-none" />

            <div
              className="relative flex items-center justify-center transition-transform duration-200 ease-out will-change-transform z-10"
              style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.05)`,
              }}
            >
              {/* Sombra de suelo difusa */}
              <div className="absolute -bottom-4 sm:-bottom-6 w-52 sm:w-72 md:w-96 h-8 sm:h-12 bg-black/40 rounded-[100%] blur-xl sm:blur-2xl pointer-events-none" />

              {/* Imagen del producto con transición */}
              <div
                key={`img-${group.id}`}
                className={`relative flex items-center justify-center transition-all duration-500 ease-out ${
                  direction === "next"
                    ? "animate-in fade-in zoom-in-90 slide-in-from-right-10"
                    : "animate-in fade-in zoom-in-90 slide-in-from-left-10"
                }`}
              >
                <img
                  src={group.image}
                  alt={group.titleTop}
                  width={600}
                  height={460}
                  loading={activeIndex === 0 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={activeIndex === 0 ? "high" : "auto"}
                  className="max-h-[220px] sm:max-h-[320px] md:max-h-[420px] lg:max-h-[460px] w-auto object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.45)] pointer-events-none"
                />
              </div>
            </div>
          </div>

        </div>

        {/* FILA INFERIOR: FRASE DEL RUBRO + FLECHITAS DE NAVEGACIÓN ABAJO A LA DERECHA */}
        <div className="relative z-20 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-3 pt-3 sm:pt-4 mt-2">
          {/* Frase / lema del rubro */}
          <div
            key={`quote-${group.id}`}
            className="text-center sm:text-left text-[11px] sm:text-xs md:text-sm text-black/75 italic font-semibold animate-in fade-in duration-300 max-w-sm sm:max-w-md order-2 sm:order-1"
          >
            "{group.quote}"
          </div>

          {/* Flechitas de navegación */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto order-1 sm:order-2">
            <button
              onClick={goPrev}
              disabled={isAnimating}
              title="Grupo anterior"
              className="size-10 sm:size-12 rounded-full bg-black/20 hover:bg-black/35 active:scale-95 text-black hover:text-white flex items-center justify-center transition-all backdrop-blur-md border border-black/15 shadow-lg disabled:opacity-50"
            >
              <ChevronLeft className="size-4 sm:size-5 stroke-[2.5]" />
            </button>
            <button
              onClick={goNext}
              disabled={isAnimating}
              title="Grupo siguiente"
              className="size-10 sm:size-12 rounded-full bg-black/20 hover:bg-black/35 active:scale-95 text-black hover:text-white flex items-center justify-center transition-all backdrop-blur-md border border-black/15 shadow-lg disabled:opacity-50"
            >
              <ChevronRight className="size-4 sm:size-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}
