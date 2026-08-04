const brands = [
  { name: "Bosch", image: "/brands/Bosch.png" },
  { name: "DeWalt", image: "/brands/DeWalt.png" },
  { name: "Lusqtoff", image: "/brands/Lusqtoff.jpg" },
  { name: "Hamilton", image: "/brands/Hamilton.png" },
  { name: "Bremen", image: "/brands/BREMEN.png" },
  { name: "Total", image: "/brands/Total.jpg" },
  { name: "Milwaukee", image: "/brands/Logo-Milwaukee.jpg" },
  { name: "Otras", image: "/brands/otras.jpg" },
];

export function Brands() {
  return (
    <section id="marcas" className="py-16 lg:py-20 bg-background border-y border-border scroll-mt-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 animate-fade-in-up animate-delay-300">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-yellow-500 mb-2">
            Marcas
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Trabajamos con las mejores marcas
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {brands.map((b, idx) => (
            <div
              key={b.name}
              className={`aspect-[3/2] border border-border rounded-xl flex items-center justify-center font-bold text-sm hover:shadow-card transition-all overflow-hidden relative group animate-fade-in-up animate-delay-${(idx + 4) * 100}`}
              style={{
                backgroundImage: `url('${b.image}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Imagen de fondo borrosa */}
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-all backdrop-blur-[1px]" />
              {/* Texto */}
              <span className="relative z-10 text-white font-bold text-center px-2">{b.name}</span>  
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
