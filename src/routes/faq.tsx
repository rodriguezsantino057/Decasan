import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, CreditCard, MapPin, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import { Layout } from "@/components/Layout";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
});

const faqs = [
  {
    question: "Donde esta ubicado el local?",
    answer: "Estamos en Av. Pres. Kennedy 270, La Falda, Cordoba. Podes comprar online y retirar por el local.",
  },
  {
    question: "Hacen envios a todo el pais?",
    answer: "Si. Trabajamos para enviar a todo Argentina desde La Falda. En el checkout vas a poder cotizar el envio ingresando tu codigo postal.",
  },
  {
    question: "Como se calcula el envio?",
    answer: "El sistema cotiza el envio con Andreani usando el codigo postal de destino, origen La Falda y datos del paquete. Si un destino no se puede cotizar, podes consultarnos por WhatsApp.",
  },
  {
    question: "Puedo retirar mi compra en el local?",
    answer: "Si. En el checkout podes elegir retiro en local sin costo de envio.",
  },
  {
    question: "Que medios de pago aceptan?",
    answer: "La tienda permite pagar con Mercado Pago. Tambien podes consultarnos por WhatsApp si preferis coordinar transferencia u otra forma de pago.",
  },
  {
    question: "Los productos tienen garantia?",
    answer: "Trabajamos con productos originales y marcas reconocidas. La garantia depende del fabricante y del tipo de producto.",
  },
  {
    question: "Puedo consultar antes de comprar?",
    answer: "Si. Si tenes dudas sobre medidas, compatibilidad, stock o que herramienta elegir, escribinos por WhatsApp y te asesoramos.",
  },
];

function FaqPage() {
  return (
    <Layout>
      <section className="bg-secondary text-secondary-foreground">
        <div className="container-x py-14 md:py-20">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.25em] text-primary font-medium mb-4">
              Nosotros
            </div>
            <h1 className="font-display text-4xl md:text-6xl leading-none">
              Preguntas frecuentes
            </h1>
            <p className="mt-5 text-secondary-foreground/80 leading-relaxed max-w-2xl">
              Somos Decasan Herramientas, una ferreteria de La Falda con atencion personal,
              catalogo online y envios a todo el pais.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/productos"
                className="inline-flex items-center gap-2 bg-primary text-foreground font-display tracking-wide px-6 py-3 hover:bg-primary/90 transition"
              >
                Ver catalogo <ArrowRight className="size-4" />
              </Link>
              <a
                href="https://wa.me/54 3548 59-2127"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border border-white/20 px-6 py-3 font-display tracking-wide hover:border-primary hover:text-primary transition"
              >
                Consultar por WhatsApp <MessageCircle className="size-4" />
              </a>
            </div>
          </div>
        </div>
      </section>


      <section className="container-x py-14 md:py-20">
        <div className="grid lg:grid-cols-[320px_1fr] gap-10">
          <aside>
            <h2 className="font-display text-3xl">Info util</h2>
            <div className="mt-5 space-y-4 text-sm text-muted-foreground">
              <p className="flex gap-2">
                <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                Av. Pres. Kennedy 270, La Falda, Cordoba
              </p>
              <p className="flex gap-2">
                <Clock className="size-4 text-primary shrink-0 mt-0.5" />
                Lun a Vie 08:30 a 13:00 y 16:30 a 20:30
              </p>
              <p className="flex gap-2">
                <MessageCircle className="size-4 text-primary shrink-0 mt-0.5" />
                WhatsApp: +54 3548 40-3666
              </p>
            </div>
          </aside>

          <div className="divide-y divide-border border-y border-border">
            {faqs.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-display text-lg">
                  <span>{item.question}</span>
                  <span className="text-primary group-open:rotate-90 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground max-w-3xl">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
