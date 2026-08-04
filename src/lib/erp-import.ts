export type ErpImportRow = {
  sku: string;
  nombre: string;
  codigo_fabricante: string | null;
  precio_vta_sin_iva: number | null;
  precio: number;
  categoria?: string | null;
  grupo?: string | null;
  stock?: number | null;
  descripcion?: string | null;
  activo?: boolean | null;
  precio_oferta?: number | null;
  oferta_hasta?: string | null;
};

const FIELD_ALIASES = {
  sku: ["codigo", "código", "sku", "cod", "cod_producto", "codigo_producto"],
  codigo_fabricante: ["codigo_fabricante", "código_fabricante", "cod_fabricante", "fabricante"],
  nombre: ["nombre", "producto", "articulo", "artículo", "titulo", "título", "detalle"],
  precio_vta_sin_iva: ["precio_vta_sin_iva", "precio_sin_iva", "p_vta_sin_iva"],
  precio: ["precio_de_venta", "precio_venta", "precio_vta", "precio", "precio_final"],
  categoria: ["categoria", "categoría", "cat", "rubro", "seccion", "sección"],
  grupo: ["grupo", "marca", "linea", "línea", "subcategoria", "subcategoría"],
  stock: ["stock", "cantidad", "cant", "existencia", "existencias", "stock_actual"],
  descripcion: ["descripcion", "descripción", "detalle_largo", "info", "informacion", "información"],
  activo: ["activo", "estado", "visible", "habilitado", "publicado"],
  precio_oferta: ["precio_oferta", "oferta", "precio_promocion", "precio_promo", "promocion", "promo"],
  oferta_hasta: ["oferta_hasta", "vencimiento_oferta", "fin_oferta", "oferta_fin"],
} as const;

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSku(value: unknown) {
  return String(value ?? "").trim();
}

function parseMoney(value: unknown) {
  if (typeof value === "number") return normalizeErpPrice(value);
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  const hasComma = cleaned.includes(",");
  const normalized = hasComma
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/\./g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeErpPrice(value: number) {
  if (!Number.isFinite(value)) return null;
  if (Number.isInteger(value) && value > 100000 && value % 1000 === 0) {
    return value / 1000;
  }
  return value;
}

function parseBoolean(value: unknown): boolean | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value;
  const str = String(value).trim().toLowerCase();
  if (str === "1" || str === "true" || str === "si" || str === "sí" || str === "yes" || str === "activo" || str === "habilitado") {
    return true;
  }
  if (str === "0" || str === "false" || str === "no" || str === "inactivo" || str === "deshabilitado") {
    return false;
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getValue(row: Record<string, unknown>, aliases: readonly string[]) {
  const keys = Object.keys(row);
  const normalized = new Map(keys.map((key) => [normalizeHeader(key), key]));
  for (const alias of aliases) {
    const key = normalized.get(normalizeHeader(alias));
    if (key !== undefined) return row[key];
  }
  return null;
}

function hasField(row: Record<string, unknown>, aliases: readonly string[]) {
  const keys = Object.keys(row);
  const normalized = new Set(keys.map(normalizeHeader));
  for (const alias of aliases) {
    if (normalized.has(normalizeHeader(alias))) return true;
  }
  return false;
}

export async function parseErpProductFile(file: File): Promise<ErpImportRow[]> {
  const XLSX = await import("xlsx");
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string", raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no tiene hojas.");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const parsed: ErpImportRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const sku = normalizeSku(getValue(row, FIELD_ALIASES.sku));
    const nombre = String(getValue(row, FIELD_ALIASES.nombre) ?? "").trim();
    const precio = parseMoney(getValue(row, FIELD_ALIASES.precio));
    if (!sku || !nombre || precio == null) continue;
    if (seen.has(sku)) continue;
    seen.add(sku);

    const parsedRow: ErpImportRow = {
      sku,
      nombre,
      codigo_fabricante: normalizeSku(getValue(row, FIELD_ALIASES.codigo_fabricante)) || null,
      precio_vta_sin_iva: parseMoney(getValue(row, FIELD_ALIASES.precio_vta_sin_iva)),
      precio,
    };

    if (hasField(row, FIELD_ALIASES.categoria)) {
      parsedRow.categoria = String(getValue(row, FIELD_ALIASES.categoria) ?? "").trim() || null;
    }
    if (hasField(row, FIELD_ALIASES.grupo)) {
      parsedRow.grupo = String(getValue(row, FIELD_ALIASES.grupo) ?? "").trim() || null;
    }
    if (hasField(row, FIELD_ALIASES.stock)) {
      parsedRow.stock = parseNumber(getValue(row, FIELD_ALIASES.stock));
    }
    if (hasField(row, FIELD_ALIASES.descripcion)) {
      parsedRow.descripcion = String(getValue(row, FIELD_ALIASES.descripcion) ?? "").trim() || null;
    }
    if (hasField(row, FIELD_ALIASES.activo)) {
      parsedRow.activo = parseBoolean(getValue(row, FIELD_ALIASES.activo));
    }
    if (hasField(row, FIELD_ALIASES.precio_oferta)) {
      parsedRow.precio_oferta = parseMoney(getValue(row, FIELD_ALIASES.precio_oferta));
    }
    if (hasField(row, FIELD_ALIASES.oferta_hasta)) {
      parsedRow.oferta_hasta = String(getValue(row, FIELD_ALIASES.oferta_hasta) ?? "").trim() || null;
    }

    parsed.push(parsedRow);
  }

  return parsed;
}

export const parseErpExcelFile = parseErpProductFile;
