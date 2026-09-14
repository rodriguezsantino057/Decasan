export interface ZipnovaQuoteResult {
  id: string; // identificador único de la cotización / opción
  costo: number;
  diasEstimados: number;
  label: string;
  carrierName?: string;
  carrierId?: number;
  serviceTypeCode?: string;
  logisticType?: string;
}

export interface ZipnovaShipmentDestination {
  nombre?: string;
  email?: string;
  telefono?: string;
  direccion?: {
    calle?: string | null;
    numero?: string | null;
    piso?: string | null;
    ciudad?: string | null;
    provincia?: string | null;
    codigo_postal?: string | null;
  } | null;
  [key: string]: any;
}

const ZIPNOVA_API_BASE = process.env.ZIPNOVA_API_URL || "https://api.zipnova.com.ar/v2";

function getAuthHeaders(): Record<string, string> | null {
  const token = process.env.ZIPNOVA_TOKEN;
  const secret = process.env.ZIPNOVA_SECRET;

  if (!token) return null;

  if (secret) {
    const basic = Buffer.from(`${token}:${secret}`).toString("base64");
    return {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function calculateFallbackRate(pesoKg = 1): number {
  const base = Number(process.env.SHIPPING_FALLBACK_BASE || 500);
  const perKg = Number(process.env.SHIPPING_FALLBACK_PER_KG || 50);
  return Math.round(base + Math.max(0, pesoKg - 1) * perKg);
}

function getFallbackQuote(cpDestino: string, pesoKg = 1): ZipnovaQuoteResult {
  const costo = calculateFallbackRate(pesoKg);
  const diasEstimados = Number(process.env.ZIPNOVA_DEFAULT_DELIVERY_DAYS || 5);

  return {
    id: "zipnova_envio",
    costo,
    diasEstimados,
    label: "Envío a Domicilio (Zipnova)",
    carrierName: "Zipnova",
    serviceTypeCode: "standard",
  };
}

/**
 * Genera un PDF mínimo válido en base64 para pruebas y modo mock
 */
function generateMockPdfBase64(trackingNumber: string): string {
  const content = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 160 >> stream
BT
/F1 14 Tf
30 350 Td
(DECASAN - ETIQUETA DE ENVIO) Tj
/F1 10 Tf
0 -30 Td
(Carrier: Zipnova) Tj
0 -20 Td
(Tracking: ${trackingNumber}) Tj
0 -20 Td
(Fecha: ${new Date().toLocaleDateString("es-AR")}) Tj
0 -20 Td
(Modo: Pruebas / Mock) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000456 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
525
%%EOF`;
  return Buffer.from(content).toString("base64");
}

/**
 * Parsea una duración ISO 8601 (ej: "P5DT12H", "P4DT12H", "PT0S") a días,
 * redondeando hacia arriba. Devuelve null si no se puede parsear.
 */
function parseIsoDurationDays(duration?: string | null): number | null {
  if (!duration) return null;
  const match = duration.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  const totalDays = days + hours / 24 + minutes / (24 * 60) + seconds / (24 * 3600);
  return Math.ceil(totalDays);
}

/**
 * Cotiza un envío a través de Zipnova por código postal.
 * Si faltan credenciales o se activa ZIPNOVA_MOCK, utiliza las tarifas de fallback.
 */
export async function getZipnovaQuote(
  cpDestino: string,
  pesoKg = 1,
  valorDeclarado = 1000,
  provincia?: string | null,
  ciudad?: string | null
): Promise<ZipnovaQuoteResult | null> {
  const isMock = process.env.ZIPNOVA_MOCK === "true";
  const headers = getAuthHeaders();

  // El fallback de tarifas SOLO se usa en modo mock (pruebas internas).
  // En producción, si no hay credenciales o la API falla, no se cotiza:
  // el checkout muestra solo retiro en local y contacto por WhatsApp,
  // evitando cobrar un precio inventado.
  if (isMock) {
    console.info("[zipnova] Usando cotización fallback/mock", {
      reason: "ZIPNOVA_MOCK activado",
      cpDestino,
    });
    return getFallbackQuote(cpDestino, pesoKg);
  }

  if (!headers) {
    console.warn("[zipnova] Sin credenciales ZIPNOVA, no se cotiza", { cpDestino });
    return null;
  }

  try {
    const accountId = process.env.ZIPNOVA_ACCOUNT_ID;
    const originId = process.env.ZIPNOVA_ORIGIN_ID;
    const declaredValue = Number(process.env.SHIPPING_DECLARED_VALUE || valorDeclarado);
    const weightGrams = Math.round(pesoKg * 1000);

    const body: Record<string, any> = {
      account_id: accountId ? Number(accountId) : undefined,
      source: "Decasan Ecommerce",
      declared_value: declaredValue,
      destination: {
        zipcode: cpDestino.trim(),
        ...(provincia ? { state: provincia } : {}),
        ...(ciudad ? { city: ciudad } : {}),
      },
      items: [
        {
          weight: Math.max(10, weightGrams),
          height: Number(process.env.SHIPPING_DEFAULT_HEIGHT_CM || 10),
          width: Number(process.env.SHIPPING_DEFAULT_WIDTH_CM || 20),
          length: Number(process.env.SHIPPING_DEFAULT_LENGTH_CM || 20),
          description: process.env.SHIPPING_PRODUCT_CATEGORY || "Herramientas y equipamiento",
        },
      ],
    };

    if (originId) {
      body.origin_id = Number(originId);
    }

    const response = await fetch(`${ZIPNOVA_API_BASE}/shipments/quote`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("[zipnova] Falló cotización API:", { status: response.status, errorText });
      return null;
    }

    const data = await response.json();

    // Seleccionamos la mejor opción (o la primera elegible de results/all_results)
    const options: any[] = Array.isArray(data.all_results)
      ? data.all_results
      : data.results
      ? Object.values(data.results)
      : [];

    const selected = options.find((opt) => opt.selectable !== false) || options[0];

    if (!selected) {
      console.warn("[zipnova] No se encontraron opciones válidas en la respuesta");
      return null;
    }

    const costo = Number(selected.amounts?.price_incl_tax || selected.amounts?.price || 0);

    if (!Number.isFinite(costo)) {
      console.warn("[zipnova] Precio inválido en la respuesta", { costo });
      return null;
    }

    const carrierName = selected.carrier?.name || "Zipnova";
    const parsedDays = parseIsoDurationDays(selected.delivery_time?.times?.total?.max);
    const diasEstimados =
      parsedDays != null
        ? parsedDays
        : Number(selected.delivery_time?.max) ||
          Number(process.env.ZIPNOVA_DEFAULT_DELIVERY_DAYS || 5);

    return {
      id: "zipnova_envio",
      costo,
      diasEstimados,
      label: `Envío a Domicilio (${carrierName})`,
      carrierName,
      carrierId: selected.carrier?.id,
      serviceTypeCode: selected.service_type?.code || "standard",
      logisticType: selected.logistic_type,
    };
  } catch (err) {
    console.error("[zipnova] Excepción al cotizar con Zipnova:", err);
    return null;
  }
}

/**
 * Crea una orden de despacho de envío en Zipnova para un pedido pagado.
 */
export async function createZipnovaShipping(pedidoId: string, pedidoInfo: ZipnovaShipmentDestination): Promise<string> {
  const isMock = process.env.ZIPNOVA_MOCK === "true";
  const headers = getAuthHeaders();

  if (isMock || !headers) {
    const mockTracking = `ZN-MOCK-${Date.now().toString().slice(-6)}`;
    console.info("[zipnova] Creando envío mock", { pedidoId, mockTracking });
    return mockTracking;
  }

  const accountId = process.env.ZIPNOVA_ACCOUNT_ID;
  const originId = process.env.ZIPNOVA_ORIGIN_ID || "auto";
  const declaredValue = Number(pedidoInfo.total || process.env.SHIPPING_DECLARED_VALUE || 1000);
  const dir = pedidoInfo.direccion;

  const body = {
    account_id: accountId ? Number(accountId) : undefined,
    external_id: String(pedidoId).slice(0, 30),
    service_type: "standard",
    origin_id: originId,
    declared_value: declaredValue,
    source: "Decasan Ecommerce",
    process_immediately: 1,
    destination: {
      name: pedidoInfo.nombre || "Cliente Decasan",
      document: pedidoInfo.documento || "00000000",
      email: pedidoInfo.email || "ventas@decasan.com.ar",
      phone: pedidoInfo.telefono || "00000000",
      street: dir?.calle || "Destino",
      street_number: dir?.numero || "S/N",
      street_extras: dir?.piso || undefined,
      city: dir?.ciudad || "Destino",
      state: dir?.provincia || "Córdoba",
      zipcode: dir?.codigo_postal || undefined,
    },
    items: [
      {
        weight: 1000,
        height: Number(process.env.SHIPPING_DEFAULT_HEIGHT_CM || 10),
        width: Number(process.env.SHIPPING_DEFAULT_WIDTH_CM || 20),
        length: Number(process.env.SHIPPING_DEFAULT_LENGTH_CM || 20),
        description: process.env.SHIPPING_PRODUCT_CATEGORY || "Herramientas y equipamiento",
      },
    ],
  };

  const response = await fetch(`${ZIPNOVA_API_BASE}/shipments`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[zipnova] Error creando envío:", { status: response.status, text });
    throw new Error("Zipnova rechazó la orden de envío");
  }

  const data = await response.json();
  const trackingNumber =
    data.carrier_tracking_id ||
    data.delivery_id ||
    data.packages?.[0]?.label_code ||
    (data.id ? String(data.id) : null);

  if (!trackingNumber) {
    throw new Error("No se recibió número de tracking de Zipnova");
  }

  return String(trackingNumber);
}

/**
 * Obtiene la etiqueta del envío en formato base64 (PDF).
 */
export async function getZipnovaLabelBase64(shipmentIdOrTracking: string | number): Promise<string> {
  const isMock = process.env.ZIPNOVA_MOCK === "true";
  const headers = getAuthHeaders();
  const trackingStr = String(shipmentIdOrTracking);

  if (isMock || !headers || trackingStr.startsWith("ZN-MOCK")) {
    console.info("[zipnova] Generando etiqueta mock en base64 para", trackingStr);
    return generateMockPdfBase64(trackingStr);
  }

  const url = `${ZIPNOVA_API_BASE}/shipments/${encodeURIComponent(trackingStr)}/label.pdf`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: headers.Authorization,
      Accept: "application/pdf, application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[zipnova] Falló descarga de etiqueta:", { status: response.status, text });
    throw new Error("No se pudo obtener la etiqueta de Zipnova");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await response.json();
    if (json.base64) return json.base64;
    if (json.content) return json.content;
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

// =====================================================================
// Dashboard de envíos (admin) — listado, detalle y seguimiento
// =====================================================================

export interface ZipnovaShipmentSummary {
  id: string | number;
  externalId?: string;
  status?: string;
  carrierName?: string;
  serviceType?: string;
  destination?: {
    name?: string;
    city?: string;
    state?: string;
    zipcode?: string;
    street?: string;
  };
  trackingNumber?: string;
  createdAt?: string;
  price?: number;
  raw: any;
}

export interface ZipnovaShipmentListResult {
  data: ZipnovaShipmentSummary[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

function pick(obj: any, keys: string[]): any {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

/**
 * Normaliza un shipment crudo de la API a una forma estable para la UI.
 * Como la estructura exacta puede variar, se prueban varios nombres de campo
 * y se conserva el objeto crudo (raw) para poder inspeccionarlo.
 */
function normalizeShipment(raw: any): ZipnovaShipmentSummary {
  const destination = raw.destination || raw.destino || {};
  const carrier = raw.carrier || {};
  const serviceType = raw.service_type || raw.serviceType || {};
  const amounts = raw.amounts || {};

  return {
    id: raw.id ?? raw.shipment_id ?? raw.delivery_id ?? "?",
    externalId: pick(raw, ["external_id", "externalId", "reference", "pedido_id"]),
    status: pick(raw, ["status", "state", "estado"]),
    carrierName: pick(carrier, ["name", "nombre"]) || pick(raw, ["carrier_name", "transportista"]),
    serviceType: pick(serviceType, ["code", "name", "nombre"]) || pick(raw, ["service_type_code"]),
    destination: {
      name: pick(destination, ["name", "nombre"]),
      city: pick(destination, ["city", "ciudad", "localidad"]),
      state: pick(destination, ["state", "provincia", "region"]),
      zipcode: pick(destination, ["zipcode", "codigo_postal", "postal_code"]),
      street: pick(destination, ["street", "calle"]),
    },
    trackingNumber: pick(raw, ["carrier_tracking_id", "tracking_number", "tracking", "delivery_id"]),
    createdAt: pick(raw, ["created_at", "createdAt", "fecha_creacion"]),
    price: Number(pick(amounts, ["price_incl_tax", "price", "total"]) ?? pick(raw, ["price", "costo"]) ?? 0) || undefined,
    raw,
  };
}

/**
 * Lista los envíos creados en Zipnova (paginado).
 * Devuelve null si no hay credenciales o la API falla.
 */
export async function listZipnovaShipments(page = 1, perPage = 20): Promise<ZipnovaShipmentListResult | null> {
  const headers = getAuthHeaders();
  if (!headers) {
    console.warn("[zipnova] Sin credenciales, no se puede listar envíos");
    return null;
  }

  try {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    const response = await fetch(`${ZIPNOVA_API_BASE}/shipments?${params}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn("[zipnova] Falló listado de envíos:", { status: response.status, text });
      return null;
    }

    const json = await response.json();
    const data = Array.isArray(json.data) ? json.data : [];
    const meta = json.meta || {};

    return {
      data: data.map(normalizeShipment),
      currentPage: Number(meta.current_page || 1),
      lastPage: Number(meta.last_page || 1),
      perPage: Number(meta.per_page || perPage),
      total: Number(meta.total || 0),
    };
  } catch (err) {
    console.error("[zipnova] Excepción al listar envíos:", err);
    return null;
  }
}

/**
 * Obtiene el detalle completo de un envío.
 */
export async function getZipnovaShipment(id: string | number): Promise<any | null> {
  const headers = getAuthHeaders();
  if (!headers) return null;
  try {
    const response = await fetch(`${ZIPNOVA_API_BASE}/shipments/${encodeURIComponent(String(id))}`, {
      method: "GET",
      headers,
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn("[zipnova] Falló detalle de envío:", { status: response.status, text });
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error("[zipnova] Excepción al obtener detalle:", err);
    return null;
  }
}

/**
 * Obtiene el seguimiento (eventos) de un envío.
 */
export async function getZipnovaShipmentTracking(id: string | number): Promise<any | null> {
  const headers = getAuthHeaders();
  if (!headers) return null;
  try {
    const response = await fetch(`${ZIPNOVA_API_BASE}/shipments/${encodeURIComponent(String(id))}/tracking`, {
      method: "GET",
      headers,
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn("[zipnova] Falló tracking de envío:", { status: response.status, text });
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error("[zipnova] Excepción al obtener tracking:", err);
    return null;
  }
}
