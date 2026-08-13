import { z } from "zod";

export interface AndreaniQuoteResult {
  id: string; // tarifa/contrato
  costo: number;
  diasEstimados: number;
  label: string;
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Falta variable de entorno: ${key}`);
  return value;
}

async function getAndreaniToken(): Promise<string> {
  const username = getEnvOrThrow("ANDREANI_USERNAME");
  const password = getEnvOrThrow("ANDREANI_PASSWORD");
  const loginUrl = process.env.ANDREANI_LOGIN_URL || "https://apis.andreani.com/login";

  const tokenBase64 = Buffer.from(`${username}:${password}`).toString("base64");
  
  const response = await fetch(loginUrl, {
    headers: {
      Authorization: `Basic ${tokenBase64}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[andreani] Login failed", { status: response.status, body: text });
    throw new Error("No se pudo autenticar con Andreani");
  }

  const token = response.headers.get("x-authorization-token");
  if (!token) throw new Error("No se recibio token de Andreani");
  
  return token;
}

export async function getAndreaniQuote(cpDestino: string): Promise<AndreaniQuoteResult | null> {
  try {
    const client = getEnvOrThrow("ANDREANI_CLIENT");
    const contract = getEnvOrThrow("ANDREANI_CONTRACT");
    const cpOrigen = getEnvOrThrow("SHIPPING_ORIGIN_CP");
    
    // Convert to query params
    const params = new URLSearchParams({
      "cliente": client,
      "contrato": contract,
      "cpDestino": cpDestino,
      "cpOrigen": cpOrigen,
      "bultos[0].kilos": "1", 
      "bultos[0].volumen": "1000",
      "bultos[0].valorDeclarado": process.env.SHIPPING_DECLARED_VALUE || "1000",
    });

    const quoteUrl = (process.env.ANDREANI_QUOTE_URL || "https://apis.andreani.com/v1/tarifas") + "?" + params.toString();

    const response = await fetch(quoteUrl, {
      method: "GET",
    });

    if (!response.ok) {
      console.warn("[andreani] Falló cotización", await response.text());
      return null;
    }

    const data = await response.json();
    let costo = 0;
    if (data.tarifaConIva) {
      costo = Number(data.tarifaConIva.total);
    } else if (data.tarifa) {
      costo = Number(data.tarifa);
    }

    if (!costo) return null;

    return {
      id: "andreani_envio",
      costo: costo,
      diasEstimados: Number(process.env.ANDREANI_DEFAULT_DELIVERY_DAYS || 5),
      label: "Envío a Domicilio (Andreani)",
    };
  } catch (err) {
    console.error("[andreani] Error cotizando:", err);
    return null;
  }
}

export async function createAndreaniShipping(pedidoId: string, pedidoInfo: any) {
  const token = await getAndreaniToken();
  const contract = getEnvOrThrow("ANDREANI_CONTRACT");
  const ordersUrl = "https://apis.andreani.com/v2/ordenesDeEnvio";

  const body = {
    contrato: contract,
    origen: {
      postal: {
        codigoPostal: getEnvOrThrow("SHIPPING_ORIGIN_CP"),
        calle: "Origen",
        numero: "123",
        localidad: getEnvOrThrow("SHIPPING_ORIGIN_CITY"),
        region: "Córdoba",
      }
    },
    destino: {
      postal: {
        codigoPostal: pedidoInfo.direccion?.codigo_postal,
        calle: pedidoInfo.direccion?.calle || "Destino",
        numero: pedidoInfo.direccion?.numero || "S/N",
        localidad: pedidoInfo.direccion?.ciudad || "Destino",
        region: pedidoInfo.direccion?.provincia || "Destino",
      }
    },
    remitente: {
      nombreCompleto: "Decasan",
      email: "ventas@decasan.com.ar",
      telefonos: [{ numero: "11111111", tipo: 1 }]
    },
    destinatario: [
      {
        nombreCompleto: pedidoInfo.nombre,
        email: pedidoInfo.email,
        telefonos: [{ numero: pedidoInfo.telefono || "000", tipo: 1 }]
      }
    ],
    bultos: [
      {
        kilos: 1,
        volumen: 1000,
        valorDeclarado: Number(pedidoInfo.total)
      }
    ]
  };

  const response = await fetch(ordersUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-authorization-token": token,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[andreani] Error creando envío", { status: response.status, text });
    throw new Error("Andreani rechazó la orden de envío");
  }

  const data = await response.json();
  const trackingNumber = data.bultos?.[0]?.numeroDeEnvio || data.numeroDeEnvio;
  return trackingNumber;
}

export async function getAndreaniLabelBase64(trackingNumber: string): Promise<string> {
  const token = await getAndreaniToken();
  const labelUrl = `https://apis.andreani.com/v2/ordenesDeEnvio/${trackingNumber}/etiquetas`;

  const response = await fetch(labelUrl, {
    headers: {
      "x-authorization-token": token,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[andreani] Falló obtener etiqueta", { trackingNumber, status: response.status, text });
    throw new Error("No se pudo obtener la etiqueta de Andreani");
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}
