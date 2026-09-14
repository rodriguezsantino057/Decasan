import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getZipnovaQuote } from "./zipnova";

export type Transportista = "zipnova" | "cadete" | "retiro_local";

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
  zipnova: "Zipnova",
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
  ciudad: z.string().trim().max(80).optional().nullable(),
});

export const getShippingOptions = createServerFn({ method: "GET" })
  .inputValidator((d) => shippingOptionsSchema.parse(d ?? {}))
  .handler(async ({ data }): Promise<ShippingOption[]> => {
    const options: ShippingOption[] = [getLocalPickupOption()];

    const cadete = await getCadeteOption(data.codigoPostal, data.ciudad);
    if (cadete) options.push(cadete);

    if (data.codigoPostal) {
      const zipnovaQuote = await getZipnovaQuote(data.codigoPostal, 1, 1000, data.provincia, data.ciudad);
      if (zipnovaQuote) {
        options.push({
          id: zipnovaQuote.id,
          transportista: "zipnova",
          provincia: data.provincia ?? null,
          costo: zipnovaQuote.costo,
          label: zipnovaQuote.label,
          dias_estimados_min: zipnovaQuote.diasEstimados,
          dias_estimados_max: zipnovaQuote.diasEstimados + 2,
          codigo_servicio: zipnovaQuote.id,
          servicio: TRANSPORTISTA_LABEL["zipnova"],
          descripcion: zipnovaQuote.label,
          dias_habiles: zipnovaQuote.diasEstimados + 2,
          precio: zipnovaQuote.costo,
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

// --- Cadete (envío local La Falda y alrededores) ---

const CADETE_ZONE_CPS = new Set(["5172", "5168", "5176", "5178", "5166", "5153", "5164", "5182", "5184"]);
const CADETE_ZONE_CITIES = [
  "la falda",
  "valle hermoso",
  "huerta grande",
  "villa giardino",
  "cosquin",
  "bialet masse",
  "santa maria de punilla",
  "la cumbre",
  "capilla del monte",
  "los cocos",
];

export function isCadeteZone(codigoPostal?: string | null, ciudad?: string | null): boolean {
  const cp = codigoPostal?.trim();
  if (cp && CADETE_ZONE_CPS.has(cp)) return true;
  if (ciudad) {
    const normalized = normalizeProvince(ciudad);
    if (CADETE_ZONE_CITIES.includes(normalized)) return true;
  }
  return false;
}

export type ShippingOptionRow = {
  id: string;
  transportista: string;
  provincia: string | null;
  costo: number | string;
  label: string;
  activo?: boolean;
  dias_estimados_min: number | null;
  dias_estimados_max: number | null;
};

export function mapShippingOptionRow(row: ShippingOptionRow): ShippingOption {
  const transportista = row.transportista as Transportista;
  return {
    id: row.id,
    transportista,
    provincia: row.provincia,
    costo: Number(row.costo),
    label: row.label,
    dias_estimados_min: row.dias_estimados_min,
    dias_estimados_max: row.dias_estimados_max,
    codigo_servicio: row.id,
    servicio: TRANSPORTISTA_LABEL[transportista] ?? transportista,
    descripcion: row.label,
    dias_habiles: row.dias_estimados_max ?? row.dias_estimados_min ?? 1,
    precio: Number(row.costo),
    tipo: "local",
  };
}

async function getCadeteOption(
  codigoPostal?: string | null,
  ciudad?: string | null
): Promise<ShippingOption | null> {
  if (!isCadeteZone(codigoPostal, ciudad)) return null;
  try {
    const { data } = await supabaseAdmin
      .from("shipping_options")
      .select("id, transportista, provincia, costo, label, activo, dias_estimados_min, dias_estimados_max")
      .eq("transportista", "cadete")
      .eq("activo", true)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return mapShippingOptionRow(data as ShippingOptionRow);
  } catch (err) {
    console.error("[shipping] cadete option load failed", err);
    return null;
  }
}
