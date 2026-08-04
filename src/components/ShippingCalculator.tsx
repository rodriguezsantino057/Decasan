import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Store, Truck } from "lucide-react";
import { formatARS } from "@/lib/format";
import { formatDias, getShippingOptions, LOCAL_PICKUP_CODE } from "@/lib/shipping.functions";
import type { ShippingOption } from "@/lib/shipping.functions";

interface ShippingCalculatorProps {
  provincia: string;
  codigoPostal?: string;
  ciudad?: string;
  onShippingSelect?: (option: ShippingOption | null) => void;
  selectedShipping?: string;
}

export function ShippingCalculator({
  provincia,
  onShippingSelect,
  selectedShipping,
}: ShippingCalculatorProps) {
  const shippingFn = useServerFn(getShippingOptions);
  const [localSelected, setLocalSelected] = useState<string>(selectedShipping || "");
  const canShowProvinceRates = provincia.trim().length > 0;

  const { data: opciones, isLoading, error } = useQuery({
    queryKey: ["shipping-options", provincia],
    queryFn: () => shippingFn({ data: { provincia } }),
  });

  const shippingOptions = useMemo(() => {
    return opciones ?? [];
  }, [opciones]);

  useEffect(() => {
    setLocalSelected("");
    onShippingSelect?.(null);
  }, [provincia]);

  useEffect(() => {
    if (!localSelected && shippingOptions[0]) {
      setLocalSelected(shippingOptions[0].codigo_servicio);
      onShippingSelect?.(shippingOptions[0]);
    }
  }, [localSelected, onShippingSelect, shippingOptions]);

  if (isLoading) {
    return (
      <div className="border border-border bg-muted/30 p-4 flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando opciones de envio...</p>
      </div>
    );
  }

  if (error) {
    console.error("Fallo la carga de envios:", error);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Truck className="size-4" />
        Entrega
      </h3>
      {!canShowProvinceRates && (
        <p className="text-xs text-muted-foreground">
          Elegi una provincia para ver las tarifas disponibles. Tambien podes retirar por el local.
        </p>
      )}
      {canShowProvinceRates && shippingOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No hay tarifas activas para esa provincia. Probá con retiro en local o consultanos por WhatsApp.
        </p>
      )}
      <div className="space-y-2">
        {shippingOptions.map((opcion) => (
          <label
            key={opcion.codigo_servicio}
            className="flex items-center gap-3 border border-border p-3 cursor-pointer transition hover:bg-muted/50"
          >
            <input
              type="radio"
              name="shipping"
              value={opcion.codigo_servicio}
              checked={localSelected === opcion.codigo_servicio}
              onChange={(e) => {
                setLocalSelected(e.target.value);
                onShippingSelect?.(opcion);
              }}
              className="size-4"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm flex items-center gap-2">
                {opcion.codigo_servicio === LOCAL_PICKUP_CODE && <Store className="size-3" />}
                <span className="truncate">{opcion.descripcion}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDias(opcion.dias_estimados_min, opcion.dias_estimados_max) || "Entrega a coordinar"}
              </p>
            </div>
            <p className="font-semibold text-sm whitespace-nowrap">
              {opcion.precio === 0 ? "Sin costo" : formatARS(opcion.precio)}
            </p>
          </label>
        ))}
      </div>
    </div>
  );
}
