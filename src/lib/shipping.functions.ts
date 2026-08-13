import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAndreaniQuote } from "./andreani";

export type Transportista = "correo_argentino" | "andreani" | "cadete" | "retiro_local";

export type ShippingOption = {
  id: string;
  transportista: Transportista;
  provincia: string | null;
  costo: number;
  label: string;
  dias_estimados_min: number | null;
  dias_estimados_max: number | null;
  codigo_servicio: string;
  servicio: string;
  descripcion: string;
  dias_habiles: number;
  precio: number;
  tipo: "local" | "domicilio";
};

export const LOCAL_PICKUP_CODE = "retiro-local";

export const TRANSPORTISTA_LABEL: Record<Transportista, string> = {
  correo_argentino: "Correo Argentino",
  andreani: "Andreani",
  cadete: "Cadete",
  retiro_local: "Retiro en local",
};

export const SHIPPING_PROVINCES = [
  "Buenos Aires",
  "Ciudad Autonoma de Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Cordoba",
  "Corrientes",
  "Entre Rios",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquen",
  "Rio Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucuman",
] as const;

const shippingOptionsSchema = z.object({
  provincia: z.string().trim().max(80).optional().nullable(),
  codigoPostal: z.string().trim().max(8).optional().nullable(),
});

export const getShippingOptions = createServerFn({ method: "GET" })
  .inputValidator((d) => shippingOptionsSchema.parse(d ?? {}))
  .handler(async ({ data }): Promise<ShippingOption[]> => {
    const options: ShippingOption[] = [getLocalPickupOption()];

    if (data.codigoPostal) {
      const andreaniQuote = await getAndreaniQuote(data.codigoPostal);
      if (andreaniQuote) {
        options.push({
          id: andreaniQuote.id,
          transportista: "andreani",
          provincia: data.provincia ?? null,
          costo: andreaniQuote.costo,
          label: andreaniQuote.label,
          dias_estimados_min: andreaniQuote.diasEstimados,
          dias_estimados_max: andreaniQuote.diasEstimados + 2,
          codigo_servicio: andreaniQuote.id,
          servicio: TRANSPORTISTA_LABEL["andreani"],
          descripcion: andreaniQuote.label,
          dias_habiles: andreaniQuote.diasEstimados + 2,
          precio: andreaniQuote.costo,
          tipo: "domicilio",
        });
      }
    }

    return options.sort((a, b) => a.costo - b.costo);
  });

export function formatDias(min: number | null, max: number | null): string {
  if (min === 0 && max === 0) return "Inmediato";
  if (min == null && max == null) return "";
  if (min != null && max != null && min === max) return `${min} dias habiles`;
  if (min != null && max != null) return `${min}-${max} dias habiles`;
  return `${min ?? max} dias habiles`;
}

export function getLocalPickupOption(): ShippingOption {
  return {
    id: LOCAL_PICKUP_CODE,
    transportista: "retiro_local",
    provincia: null,
    costo: 0,
    label: "Retiro en local - La Falda",
    dias_estimados_min: 0,
    dias_estimados_max: 0,
    codigo_servicio: LOCAL_PICKUP_CODE,
    servicio: TRANSPORTISTA_LABEL.retiro_local,
    descripcion: "Retiro por el local - Av. Pres. Kennedy 270, La Falda",
    dias_habiles: 0,
    precio: 0,
    tipo: "local",
  };
}

export function normalizeProvince(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
