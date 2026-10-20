import { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, RotateCcw, ShieldCheck, Zap, Sparkles, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { formatARS } from "@/lib/format";

interface Hero3DProduct {
  id: number;
  slug: string;
  categoryBadge: string;
  name: string;
  subtitle: string;
  description: string;
  image: string;
  basePrice: number;
  specs: { label: string; value: string }[];
  hotspots: { x: number; y: number; title: string; desc: string }[];
  variants: { label: string; priceMultiplier: number; badge: string }[];
}

const PRODUCTS: Hero3DProduct[] = [
  {
    id: 3064,
    slug: "taladro-percutor-550w",
    categoryBadge: "Línea Perforación",
    name: "Taladro Percutor 550W",
    subtitle: "Velocidad Variable + Maletín Pro",
    description: "Diseñado para exigencia continua en mampostería, acero y madera. Mandril metálico de 10mm de ajuste rápido.",
    image: "https://rgxsaklqjshhqpybqllp.supabase.co/storage/v1/object/public/product-images/migrated/1o3649e.png",
    basePrice: 111050,
    specs: [
      { label: "Potencia", value: "550 Watts" },
      { label: "Mandril", value: "10 mm" },
      { label: "Acción", value: "Percutor + Giro" },
      { label: "Control", value: "Velocidad Variable" },
    ],
    hotspots: [
      { x: 28, y: 35, title: "Mandril Reforzado", desc: "Ajuste rápido de 10mm de alta durabilidad." },
      { x: 55, y: 48, title: "Selector Percutor", desc: "Conmutador instantáneo taladro/percutor." },
      { x: 75, y: 70, title: "Grip Ergonómico", desc: "Empuñadura soft-touch antideslizante." },
    ],
    variants: [
      { label: "Estándar (Con Maletín)", priceMultiplier: 1.0, badge: "Más Vendido" },
      { label: "Kit Set 15 Mechas", priceMultiplier: 1.18, badge: "Recomendado" },
    ],
  },
  {
    id: 3253,
    slug: "rotomartillo-dewalt-d25333k",
    categoryBadge: "Demolición & Obra",
    name: "Rotomartillo SDS-Plus 950W",
    subtitle: "Fuerza de Impacto 3.5 Joules",
    description: "Capacidad de perforación extrema hasta 28mm en hormigón armado. Sistema de amortiguación de vibraciones activo.",
    image: "https://rgxsaklqjshhqpybqllp.supabase.co/storage/v1/object/public/product-images/migrated/jwtwyb.jpg",
    basePrice: 1045260,
    specs: [
      { label: "Energía", value: "3.5 Joules" },
      { label: "Potencia", value: "950 Watts" },
      { label: "Encastre", value: "SDS Plus" },
      { label: "Capacidad", value: "28 mm Hormigón" },
    ],
    hotspots: [
      { x: 22, y: 30, title: "Cabezal SDS-Plus", desc: "Bloqueo sellado anti-polvo de obra." },
      { x: 50, y: 45, title: "Mecanismo Neumático", desc: "Cilindro reforzado de 3.5 Joules." },
      { x: 80, y: 55, title: "Control Antivibración", desc: "Protege articulaciones en uso prolongado." },
    ],
    variants: [
      { label: "Equipo en Maletín", priceMultiplier: 1.0, badge: "Heavy Duty" },
      { label: "Combo Cinceles + Mechas", priceMultiplier: 1.12, badge: "Obra Completa" },
    ],
  },
  {
    id: 3259,
    slug: "amoladora-angular-1700w",
    categoryBadge: "Corte & Desbaste",
    name: "Amoladora Angular 4½''",
    subtitle: "Motor Industrial 1700W High-Torque",
    description: "Máxima potencia para corte de metales duros y mampostería. Embrague electrónico y arranque progresivo seguro.",
    image: "https://rgxsaklqjshhqpybqllp.supabase.co/storage/v1/object/public/product-images/migrated/rp0qu5.jpg",
    basePrice: 853160,
    specs: [
      { label: "Potencia", value: "1700 Watts" },
      { label: "Disco", value: "4½ Pulgadas (115mm)" },
      { label: "Seguridad", value: "Arranque Suave" },
      { label: "Carcasa", value: "Aleación Magnesio" },
    ],
    hotspots: [
      { x: 30, y: 40, title: "Guarda Protectora", desc: "Ajuste rápido sin herramientas." },
      { x: 55, y: 50, title: "Motor Bobinado Puro", desc: "Protección epoxi contra partículas abrasivas." },
      { x: 82, y: 60, title: "Interruptor Paleta", desc: "Corte automático por liberación involuntaria." },
    ],
    variants: [
      { label: "Solo Amoladora", priceMultiplier: 1.0, badge: "Taller" },
      { label: "Kit + 10 Discos de Corte", priceMultiplier: 1.08, badge: "Ahorro" },
    ],
  },
  {
    id: 2759,
    slug: "compresor-aire-2hp-24l",
    categoryBadge: "Neumática & Pintura",
    name: "Compresor de Aire 2HP",
    subtitle: "Tanque 24L - Alta Recuperación",
    description: "Ideal para talleres, gomerías y pintura soplete. Doble manómetro, presostato automático y ruedas de traslado.",
    image: "https://rgxsaklqjshhqpybqllp.supabase.co/storage/v1/object/public/product-images/migrated/dcatw2.png",
    basePrice: 266400,
    specs: [
      { label: "Motor", value: "2.0 HP Monofásico" },
      { label: "Tanque", value: "24 Litros" },
      { label: "Caudal", value: "206 Lts/min" },
      { label: "Presión", value: "8 Bar / 115 PSI" },
    ],
    hotspots: [
      { x: 40, y: 25, title: "Doble Manómetro", desc: "Control simultáneo de tanque y salida regulada." },
      { x: 60, y: 40, title: "Cabezal de Fundición", desc: "Refrigeración por aletas de alta disipación." },
      { x: 50, y: 75, title: "Tanque Homologado", desc: "Pintura epoxi horneada anticorrosión." },
    ],
    variants: [
      { label: "Compresor Solo", priceMultiplier: 1.0, badge: "Estándar" },
      { label: "Con Kit 5 Accesorios Soplete", priceMultiplier: 1.15, badge: "Pack Taller" },
    ],
  },
  {
    id: 12223,
    slug: "caja-herramientas-20-enganche-metal",
    categoryBadge: "Almacenamiento Pro",
    name: "Caja de Herramientas 20''",
    subtitle: "Cierres Metálicos Reforzados",
    description: "Cuerpo de polipropileno de alto impacto con gavetas organizadoras desmontables y bandeja interior profunda.",
    image: "https://cdnx.jumpseller.com/ace-comaderas/image/34880485/30425.png?1693843641",
    basePrice: 61940,
    specs: [
      { label: "Largo", value: "20 Pulgadas (50 cm)" },
      { label: "Broches", value: "Metálicos Niquelados" },
      { label: "Gaveteros", value: "3 Superiores" },
      { label: "Carga", value: "Hasta 25 Kg" },
    ],
    hotspots: [
      { x: 35, y: 30, title: "Organizadores Tapa", desc: "Tapa transparente para tornillería rápida." },
      { x: 50, y: 55, title: "Cierres de Acero", desc: "Trabas metálicas de máxima presión." },
      { x: 65, y: 80, title: "Base Antigolpes", desc: "Nervaduras estructurales de polipropileno virgen." },
    ],
    variants: [
      { label: "Caja Individual", priceMultiplier: 1.0, badge: "Organización" },
      { label: "Con Set Llaves y Pinzas", priceMultiplier: 1.45, badge: "Equipamiento" },
    ],
  },
];

export function Hero3DProductConfigurator() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);

  // Estados de rotación interactiva 3D
  const [rotateX, setRotateX] = useState(-5);
  const [rotateY, setRotateY] = useState(12);
  const [isInteracting, setIsInteracting] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  const product = PRODUCTS[activeIndex];
  const variant = product.variants[activeVariantIndex] || product.variants[0];
  const calculatedPrice = Math.round(product.basePrice * variant.priceMultiplier);

  // Reset variant y hotspot al cambiar de producto
  useEffect(() => {
    setActiveVariantIndex(0);
    setActiveHotspot(null);
    setRotateX(-5);
    setRotateY(12);
  }, [activeIndex]);

  // Manejo de rotación por mouse / touch (GPU-accelerated, súper fluido)
  function handlePointerDown(e: React.PointerEvent) {
    setIsInteracting(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      rx: rotateX,
      ry: rotateY,
    };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isInteracting || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    // Limitar ángulos para mantener el realismo visual de estudio
    const newY = Math.max(-45, Math.min(45, dragStartRef.current.ry + dx * 0.35));
    const newX = Math.max(-25, Math.min(25, dragStartRef.current.rx - dy * 0.25));

    setRotateX(newX);
    setRotateY(newY);
  }

  function handlePointerUp() {
    setIsInteracting(false);
    dragStartRef.current = null;
  }

  function resetRotation() {
    setRotateX(-5);
    setRotateY(12);
  }

  return (
    <section className="relative bg-secondary text-secondary-foreground pt-4 pb-8 md:py-10 overflow-hidden select-none">
      {/* Luces y ambientación 3D de fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-0 right-10 w-96 h-96 bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="container-x relative z-10">
        
        {/* Barra superior de estado / Homecenter */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-semibold text-primary uppercase tracking-widest text-[11px]">
              Decasan 3D Showcase
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-white/60 text-[11px]">
            <span className="flex items-center gap-1"><Zap className="size-3 text-primary" /> Stock en Local</span>
            <span className="flex items-center gap-1"><ShieldCheck className="size-3 text-emerald-400" /> Garantía Oficial</span>
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL: Grid 12 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center min-h-[460px]">

          {/* COLUMNA IZQUIERDA (5 COLS): Ficha técnica interactiva y configurador */}
          <div className="lg:col-span-5 flex flex-col justify-center space-y-5 animate-in fade-in slide-in-from-left duration-300">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/15 border border-primary/30 px-3 py-1 rounded-full inline-block">
                {product.categoryBadge}
              </span>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mt-2 leading-[1.05] tracking-tight">
                {product.name}
              </h1>
              <p className="text-sm font-medium text-primary/90 mt-1">
                {product.subtitle}
              </p>
              <p className="text-xs sm:text-sm text-secondary-foreground/75 mt-2 line-clamp-2 leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Selector de Variables / Configuración en vivo */}
            <div className="bg-surface/40 backdrop-blur-md p-3.5 rounded-xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs text-white/80">
                <span className="font-semibold">Configuración de Compra:</span>
                <span className="text-[10px] text-primary font-bold uppercase">{variant.badge}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {product.variants.map((v, i) => (
                  <button
                    key={v.label}
                    onClick={() => setActiveVariantIndex(i)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all border ${
                      activeVariantIndex === i
                        ? "bg-primary text-foreground border-primary shadow-sm shadow-primary/20"
                        : "bg-white/5 hover:bg-white/10 text-white/80 border-white/10"
                    }`}
                  >
                    <div className="truncate">{v.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Grilla de Especificaciones Técnicas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 text-xs">
              {product.specs.map((s) => (
                <div key={s.label} className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-[10px] text-white/60 font-medium uppercase">{s.label}</div>
                  <div className="font-semibold text-white mt-0.5 truncate">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Precio en vivo y llamada a la acción */}
            <div className="pt-2 flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Precio Final IVA inc.</div>
                <div className="text-2xl sm:text-3xl font-display font-black text-primary">
                  {formatARS(calculatedPrice)}
                </div>
              </div>

              <Link
                to="/productos"
                search={{ q: product.name } as never}
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-foreground font-display font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-primary/25 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Comprar Ahora <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* COLUMNA CENTRAL (7 COLS): Escenario 3D Interactivo de Estudio */}
          <div className="lg:col-span-7 relative flex flex-col items-center justify-center">
            
            {/* Viewport 3D Interactivo */}
            <div
              ref={stageRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="relative w-full h-[320px] sm:h-[400px] md:h-[450px] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
              style={{ perspective: 1200 }}
            >
              {/* Pedestal / Halo de suelo */}
              <div className="absolute bottom-6 w-[280px] sm:w-[420px] h-[50px] bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-[100%] blur-xl pointer-events-none" />
              <div className="absolute bottom-10 w-[240px] sm:w-[340px] h-[16px] bg-black/60 rounded-[100%] blur-md pointer-events-none" />

              {/* Contenedor del producto 3D */}
              <div
                className="relative transition-transform duration-75 will-change-transform flex items-center justify-center"
                style={{
                  transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
                  transformStyle: "preserve-3d",
                }}
              >
                {/* Imagen del producto en alta definición */}
                <img
                  key={product.image}
                  src={product.image}
                  alt={product.name}
                  className="max-h-[260px] sm:max-h-[340px] md:max-h-[380px] w-auto object-contain drop-shadow-[0_25px_35px_rgba(0,0,0,0.65)] pointer-events-none animate-in zoom-in-95 duration-300"
                  style={{ transform: "translateZ(30px)" }}
                  loading="eager"
                />

                {/* Hotspots interactivos flotantes en 3D */}
                {product.hotspots.map((h, i) => {
                  const isOpen = activeHotspot === i;
                  return (
                    <div
                      key={h.title}
                      className="absolute z-20 pointer-events-auto"
                      style={{
                        top: `${h.y}%`,
                        left: `${h.x}%`,
                        transform: "translateZ(55px)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveHotspot(isOpen ? null : i);
                        }}
                        className="relative size-6 sm:size-7 rounded-full bg-primary text-foreground flex items-center justify-center shadow-md font-bold text-xs hover:scale-110 transition-transform"
                      >
                        <span className="size-2 rounded-full bg-foreground" />
                        <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75 pointer-events-none" />
                      </button>

                      {/* Tooltip con información */}
                      {isOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-8 left-1/2 -translate-x-1/2 w-48 p-2.5 rounded-lg bg-surface-elevated/95 border border-border backdrop-blur-md shadow-2xl text-left z-30 animate-in fade-in zoom-in-95 duration-150"
                        >
                          <div className="text-[11px] font-bold text-foreground">{h.title}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{h.desc}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Botón flotante para resetear vista */}
              <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                <span className="text-[10px] text-white/50 bg-black/40 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-1">
                  <Eye className="size-3" /> Arrastrá para girar 3D
                </span>
                <button
                  onClick={resetRotation}
                  title="Restablecer ángulo"
                  className="p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition backdrop-blur-sm"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              </div>
            </div>

            {/* SWITCHER / CARRUSEL 3D INFERIOR (Los 5 productos) */}
            <div className="w-full mt-2 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[11px] font-semibold text-white/70">
                  Seleccionar Producto Estrella ({activeIndex + 1} de {PRODUCTS.length}):
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setActiveIndex((prev) => (prev > 0 ? prev - 1 : PRODUCTS.length - 1))}
                    className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition"
                    title="Anterior"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setActiveIndex((prev) => (prev < PRODUCTS.length - 1 ? prev + 1 : 0))}
                    className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-white transition"
                    title="Siguiente"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Barra de miniaturas */}
              <div className="grid grid-cols-5 gap-2">
                {PRODUCTS.map((p, idx) => {
                  const isCurrent = activeIndex === idx;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActiveIndex(idx)}
                      className={`relative rounded-xl p-1.5 sm:p-2 flex flex-col items-center justify-between transition-all border ${
                        isCurrent
                          ? "bg-primary/20 border-primary ring-2 ring-primary/40 shadow-md"
                          : "bg-surface/30 border-white/10 hover:border-white/30 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="size-10 sm:size-12 flex items-center justify-center overflow-hidden">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="size-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-semibold text-white truncate w-full text-center mt-1">
                        {p.name.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
