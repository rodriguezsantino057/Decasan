import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Instagram, Play } from "lucide-react";

interface Reel {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
}

const FEATURED_REELS: Reel[] = [
  {
    id: "1",
    url: "https://www.instagram.com/reel/DZpsQ2VAO-p/",
    title: "Sorteo Mundialista",
    thumbnail:
      "/reel1.png",
  },
  {
    id: "2",
    url: "https://www.instagram.com/reel/DZgC5jnCffs/",
    title: "Oferton",
    thumbnail:
      "/reel2.png",
  },
  {
    id: "3",
    url: "https://www.instagram.com/reel/DZKrarSAEwb/",
    title: "Taladro Total",
    thumbnail:
      "/reel3.png",
  },
];

export function InstagramReels() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => observer.disconnect();a
  }, []);

  const handlePrev = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? FEATURED_REELS.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prev) =>
      prev === FEATURED_REELS.length - 1 ? 0 : prev + 1
    );
  };

  const goToSlide = (index: number) => setCurrentIndex(index);

  return (
    <section
      ref={sectionRef}
      id="instagram-reels"
      className="py-20 lg:py-28 bg-gradient-to-b from-surface to-surface-elevated"
    >
      <div className="container-x">
        {/* HEADER */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-1000 ${
            isVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-10"
          } animate-fade-in-up`}
        >
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl">
            Seguinos en Instagram
          </h2>

          <a
            href="https://www.instagram.com/decasanherramientas/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-8 px-6 py-3 bg-primary text-black rounded-lg animate-fade-in-up animate-delay-200"
          >
            <Instagram className="size-5" />
            Ver más contenido
          </a>
        </div>

        {/* DESKTOP */}
        <div className="hidden lg:grid grid-cols-3 gap-6">
          {FEATURED_REELS.map((reel, idx) => (
            <a
              key={reel.id}
              href={reel.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`relative rounded-2xl overflow-hidden aspect-[9/16] bg-black animate-fade-in-up animate-delay-${(idx + 3) * 100}`}
            >
              <img
                src={reel.thumbnail}
                alt={reel.title}
                className="absolute inset-0 w-full h-full object-cover"
              />

              <div className="absolute bottom-0 p-4 text-white">
                {reel.title}
              </div>

              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100">
                <Play className="text-white size-10" />
              </div>
            </a>
          ))}
        </div>

        {/* MOBILE CAROUSEL */}
        <div className="lg:hidden mt-10">
          <a
            href={FEATURED_REELS[currentIndex].url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block aspect-[9/16] rounded-2xl overflow-hidden bg-black"
          >
            <img
              src={FEATURED_REELS[currentIndex].thumbnail}
              alt={FEATURED_REELS[currentIndex].title}
              className="absolute inset-0 w-full h-full object-cover"
            />

            <div className="absolute inset-0 flex items-center justify-center">
              <Play className="text-white size-14" />
            </div>

            {/* NAV BUTTONS */}
            <button
              onClick={(e) => {
                e.preventDefault();
                handlePrev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded"
            >
              <ChevronLeft />
            </button>

            <button
              onClick={(e) => {
                e.preventDefault();
                handleNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 p-2 rounded"
            >
              <ChevronRight />
            </button>

            {/* TITLE */}
            <div className="absolute bottom-0 w-full p-4 text-white bg-gradient-to-t from-black/80">
              {FEATURED_REELS[currentIndex].title}
            </div>
          </a>

          {/* INDICATORS */}
          <div className="flex justify-center gap-2 mt-4">
            {FEATURED_REELS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                className={`h-2 rounded-full ${
                  idx === currentIndex ? "w-6 bg-primary" : "w-2 bg-gray-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}