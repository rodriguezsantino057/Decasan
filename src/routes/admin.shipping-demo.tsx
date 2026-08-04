import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getShippingOptions } from "@/lib/shipping.functions";

export const Route = createFileRoute("/admin/shipping-demo")({
  component: ShippingDemoPage,
});

export default function ShippingDemoPage() {
  const shippingFn = useServerFn(getShippingOptions);
  const [provincia, setProvincia] = useState("Cordoba");
  const [resultado, setResultado] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function calcular() {
    setCargando(true);
    setError("");
    try {
      const opciones = await shippingFn({ data: { provincia } });
      setResultado(opciones);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Demo - Tarifas de envio</h1>

        <div className="bg-card border border-border p-6 space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2">Provincia destino</label>
            <input
              type="text"
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              placeholder="Ej: Cordoba"
              className="w-full border border-border px-3 py-2 outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={calcular}
            disabled={cargando}
            className="w-full bg-primary text-primary-foreground py-2 font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {cargando ? "Buscando..." : "Ver opciones"}
          </button>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 p-4 mb-6 text-destructive">
            <strong>Error:</strong> {error}
          </div>
        )}

        {resultado.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Opciones disponibles:</h2>
            {resultado.map((opcion) => (
              <div key={opcion.id} className="bg-card border border-border p-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h3 className="font-semibold">{opcion.descripcion}</h3>
                    <p className="text-sm text-muted-foreground">{opcion.dias_habiles} dias habiles</p>
                  </div>
                  <p className="text-lg font-bold">${Number(opcion.precio).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
