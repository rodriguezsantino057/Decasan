import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

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
});

export const getShippingOptions = createServerFn({ method: "GET" })
  .inputValidator((d) => shippingOptionsSchema.parse(d ?? {}))
  .handler(async ({ data }): Promise<ShippingOption[]> => {
    const { data: rows, error } = await supabase
      .from("shipping_options")
      .select("id, transportista, provincia, costo, label, dias_estimados_min, dias_estimados_max")
      .eq("activo", true)
      .order("costo", { ascending: true })
      .order("label", { ascending: true });

    if (error) throw new Error(error.message);

    const provincia = normalizeProvince(data.provincia ?? "");
    return (rows ?? [])
      .filter((row) => row.provincia === null || normalizeProvince(row.provincia) === provincia)
      .map(toShippingOption);
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

function toShippingOption(row: {
  id: string;
  transportista: Transportista;
  provincia: string | null;
  costo: number;
  label: string;
  dias_estimados_min: number | null;
  dias_estimados_max: number | null;
}): ShippingOption {
  const min = row.dias_estimados_min;
  const max = row.dias_estimados_max;
  const isLocalPickup = row.transportista === "retiro_local";
  return {
    ...row,
    costo: Number(row.costo),
    codigo_servicio: isLocalPickup ? LOCAL_PICKUP_CODE : row.id,
    servicio: TRANSPORTISTA_LABEL[row.transportista],
    descripcion: row.label,
    dias_habiles: max ?? min ?? 0,
    precio: Number(row.costo),
    tipo: isLocalPickup ? "local" : "domicilio",
  };
}

function normalizeProvince(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
