export interface MelhorEnvioShipmentPayload {
  service: number;
  from: {
    name: string;
    phone: string;
    email: string;
    document?: string;
    company_document?: string;
    state_register?: string;
    economic_activity_code?: string;
    address: string;
    complement?: string;
    number: string;
    district: string;
    city: string;
    postal_code: string;
    state_abbr: string;
  };
  to: {
    name: string;
    phone: string;
    email: string;
    document?: string;
    company_document?: string;
    state_register?: string;
    address: string;
    complement?: string;
    number: string;
    district: string;
    city: string;
    postal_code: string;
    state_abbr: string;
    country_id: string;
  };
  products: Array<{
    name: string;
    quantity: string | number;
    unitary_value: string | number;
  }>;
  volumes: Array<{
    height: number;
    width: number;
    length: number;
    weight: number;
  }>;
  options: {
    platform?: string;
    reminder?: string;
    insurance_value: number;
    receipt: boolean;
    own_hand: boolean;
    reverse: boolean;
    non_commercial?: boolean;
    dce?: { key?: string };
    invoice?: { key?: string; xml_content?: string };
    tags?: Array<{ tag: string; url?: string | null }>;
  };
}

export interface MelhorEnvioShipmentResponse {
  id: string;
  tracking: string;
  tracking_url: string;
  label_url: string;
  protocol: string;
  status: string;
  /** Quanto o Melhor Envio cobrou da loja pela etiqueta (null se a API não informar) */
  price: number | null;
}

/** Lê um valor monetário que o ME pode mandar como número ou texto ("23.90"). */
function moneyOrNull(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export interface MelhorEnvioTrackingResponse {
  id: string;
  status: string;
  tracking?: string | null;
  timeline?: Array<{
    status: string;
    location: string;
    date: string;
    detail: string;
  }>;
}

/** Pagamento (checkout) falhou depois de a etiqueta entrar no carrinho do Melhor Envio. */
export class MelhorEnvioCheckoutError extends Error {
  shipmentId: string;
  constructor(message: string, shipmentId: string) {
    super(message);
    this.name = "MelhorEnvioCheckoutError";
    this.shipmentId = shipmentId;
  }
}

/** Mensagem legível a partir da resposta de erro do Melhor Envio (message / error / errors). */
export function meErrorMessage(body: string, fallback: string): string {
  try {
    const j = JSON.parse(body);
    const parts: string[] = [];
    if (typeof j?.message === "string" && j.message !== "The given data was invalid.") parts.push(j.message);
    if (typeof j?.error === "string") parts.push(j.error);
    if (j?.errors && typeof j.errors === "object") {
      for (const v of Object.values(j.errors)) parts.push(...(Array.isArray(v) ? v.map(String) : [String(v)]));
    }
    const uniq = [...new Set(parts.filter(Boolean))];
    if (uniq.length) return uniq.join(" · ").slice(0, 500);
  } catch {}
  return body && body.length < 300 && !body.trim().startsWith("<") ? `${fallback}: ${body}` : fallback;
}

const ME_API = "https://melhorenvio.com.br/api/v2/me";
const meHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "VirtualClothingStore/1.0",
});

export interface MeOrderInfo {
  id: string;
  status: string;
  tracking: string | null;
  protocol: string | null;
  price: number | null;
}

/** Detalhes da etiqueta no Melhor Envio (status: pending → released → generated → posted → delivered). */
export async function getMeOrder(token: string, shipmentId: string): Promise<MeOrderInfo> {
  const res = await fetch(`${ME_API}/orders/${shipmentId}`, { headers: meHeaders(token), signal: AbortSignal.timeout(20000) });
  const type = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!res.ok || !type.includes("application/json")) throw new Error(meErrorMessage(text, `Não foi possível consultar a etiqueta (HTTP ${res.status})`));
  const d = JSON.parse(text);
  return {
    id: String(d.id),
    status: String(d.status || ""),
    // Correios usa "tracking"; algumas transportadoras (ex.: Loggi) só "self_tracking"
    tracking: d.tracking || d.self_tracking || null,
    protocol: d.protocol || null,
    price: moneyOrNull(d.price),
  };
}

async function mePost(token: string, path: string, body: unknown, fallback: string): Promise<unknown> {
  const res = await fetch(`${ME_API}${path}`, { method: "POST", headers: meHeaders(token), body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const text = await res.text();
  if (!res.ok) throw new Error(meErrorMessage(text, `${fallback} (HTTP ${res.status})`));
  try { return JSON.parse(text); } catch { return {}; }
}

/** Paga a etiqueta que está no carrinho (usa o saldo da carteira do Melhor Envio). */
export async function checkoutMeShipment(token: string, shipmentId: string) {
  return mePost(token, "/shipment/checkout", { orders: [shipmentId] }, "Pagamento da etiqueta recusado");
}

/** Gera a etiqueta paga — é aqui que a transportadora atribui o código de rastreio. */
export async function generateMeShipment(token: string, shipmentId: string) {
  const r = (await mePost(token, "/shipment/generate", { orders: [shipmentId] }, "Não foi possível gerar a etiqueta")) as Record<string, { status?: boolean; message?: string }>;
  const item = r?.[shipmentId];
  if (item && item.status === false) throw new Error(item.message || "O Melhor Envio não gerou a etiqueta");
}

/** Link público de impressão (uma ou várias etiquetas no mesmo arquivo). */
export async function printMeShipments(token: string, shipmentIds: string[]): Promise<string> {
  const r = (await mePost(token, "/shipment/print", { mode: "public", orders: shipmentIds }, "Não foi possível obter a etiqueta para impressão")) as { url?: string };
  if (!r?.url) throw new Error("O Melhor Envio não devolveu o link da etiqueta");
  return r.url;
}

export async function createMelhorEnvioShipment(
  token: string,
  payload: MelhorEnvioShipmentPayload,
  senderInfo: {
    name: string;
    phone: string;
    email: string;
    address: string;
    number: string;
    district: string;
    city: string;
    postal_code: string;
    state_abbr: string;
  }
): Promise<MelhorEnvioShipmentResponse> {
  try {
    // Step 1: Add to cart
    console.log("[ME API] Adding shipment to cart...");

    // Validate and prepare address
    const toAddress = (payload.to.address || "").trim();
    if (toAddress.length < 10) {
      console.error("[ME API] Address too short:", toAddress, "length:", toAddress.length);
      throw new Error(`Recipient address must be at least 64 characters (current: ${toAddress.length})`);
    }

    // Validate from.name
    const fromName = (payload.from.name || "").trim();
    if (fromName.length === 0) {
      console.error("[ME API] from.name is empty");
      throw new Error("Sender name is required");
    }

    // Validate service
    const service = parseInt(String(payload.service));
    if (isNaN(service) || service === 0) {
      console.error("[ME API] Invalid service:", payload.service);
      throw new Error(`Invalid service ID: ${payload.service}`);
    }

    const cartPayload = {
      service: service,
      from: {
        ...payload.from,
        name: fromName.substring(0, 100),
      },
      to: {
        ...payload.to,
        address: toAddress.substring(0, 100),
      },
      products: payload.products,
      volumes: payload.volumes,
      options: {
        platform: (payload.options.platform || "VirtualClothingStore").substring(0, 100),
        ...(payload.options.reminder && { reminder: payload.options.reminder.substring(0, 100) }),
        insurance_value: payload.options.insurance_value,
        receipt: payload.options.receipt,
        own_hand: payload.options.own_hand,
        reverse: payload.options.reverse,
        non_commercial: payload.options.non_commercial,
        ...(payload.options.tags && payload.options.tags.length > 0 && { tags: payload.options.tags }),
      },
    };

    console.log("[ME API] Cart URL: https://melhorenvio.com.br/api/v2/me/cart");
    console.log("[ME API] Token: " + (token ? token.substring(0, 20) + "..." : "MISSING"));
    console.log("[ME API] Service:", cartPayload.service, "Type:", typeof cartPayload.service);
    console.log("[ME API] From Name:", cartPayload.from.name, "Length:", cartPayload.from.name.length);
    console.log("[ME API] To Address:", cartPayload.to.address, "Length:", cartPayload.to.address.length);

    const jsonBody = JSON.stringify(cartPayload);
    console.log("[ME API] SENDING JSON BODY:");
    console.log(jsonBody);

    const cartRes = await fetch("https://melhorenvio.com.br/api/v2/me/cart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "VirtualClothingStore/1.0",
      },
      body: jsonBody,
    });

    if (!cartRes.ok) {
      const error = await cartRes.text();
      console.error("[ME API] Cart error status:", cartRes.status);
      console.error("[ME API] Cart error body:", error);
      throw new Error(meErrorMessage(error, `Melhor Envio recusou a etiqueta (HTTP ${cartRes.status})`));
    }

    const cartData = await cartRes.json();
    console.log("[ME API] Cart response:", JSON.stringify(cartData, null, 2));

    // Extract shipment ID from response
    const shipmentId = cartData.id || cartData[0]?.id;
    if (!shipmentId) {
      throw new Error("No shipment ID returned from cart");
    }

    // Step 2: Checkout
    console.log("[ME API] Processing checkout for shipment ID:", shipmentId);
    const checkoutRes = await fetch("https://melhorenvio.com.br/api/v2/me/shipment/checkout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "VirtualClothingStore/1.0",
      },
      body: JSON.stringify({ orders: [shipmentId] }),
    });

    if (!checkoutRes.ok) {
      const error = await checkoutRes.text();
      console.error("[ME API] Checkout error:", error);
      // A etiqueta já está no carrinho do Melhor Envio: devolve o ID para não criar outra ao tentar de novo
      throw new MelhorEnvioCheckoutError(meErrorMessage(error, `Pagamento da etiqueta recusado (HTTP ${checkoutRes.status})`), String(shipmentId));
    }

    const checkoutData = await checkoutRes.json();
    console.log("[ME API] Checkout response:", JSON.stringify(checkoutData, null, 2));

    return {
      id: shipmentId,
      tracking: checkoutData.tracking || "",
      tracking_url: checkoutData.tracking_url || "",
      label_url: checkoutData.label_url || "",
      protocol: checkoutData.protocol || "",
      status: "created",
      // Preço da etiqueta: o item do carrinho traz "price"; o checkout traz "purchase.total"
      price:
        moneyOrNull(cartData?.price ?? cartData?.[0]?.price) ??
        moneyOrNull(checkoutData?.purchase?.total ?? checkoutData?.purchase?.amount),
    };
  } catch (error) {
    console.error("[ME API] Error creating shipment:", error);
    throw error;
  }
}

export async function getMelhorEnvioTracking(
  token: string,
  shipmentId: string
): Promise<MelhorEnvioTrackingResponse> {
  try {
    // /me/shipment/{id} doesn't exist and falls through to the website (200 + HTML); order details live at /me/orders/{id}.
    const res = await fetch(
      `https://melhorenvio.com.br/api/v2/me/orders/${shipmentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": "VirtualClothingStore/1.0",
        },
      }
    );

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.includes("application/json")) {
      const errorText = await res.text();
      console.error("[ME API] Error response status:", res.status, "content-type:", contentType);
      console.error("[ME API] Error response body:", errorText.substring(0, 200));
      throw new Error(`Failed to fetch tracking: ${res.status}`);
    }

    const data = await res.json();
    return {
      id: data.id,
      status: data.status,
      // Some carriers (e.g. Loggi) only fill self_tracking
      tracking: data.tracking || data.self_tracking || null,
    };
  } catch (error) {
    console.error("[ME API] getMelhorEnvioTracking error:", error);
    throw error;
  }
}

export async function validateShipmentLabel(
  token: string,
  shipmentId: string
): Promise<{
  valid: boolean;
  status: string;
  message: string;
  sentByCarrier: boolean;
}> {
  try {
    const tracking = await getMelhorEnvioTracking(token, shipmentId);

    // After cart + checkout Melhor Envio returns "released" (paid); "generated" once the label is printed.
    const validStatuses = ["released", "generated", "posted", "in_transit", "delivered"];

    const isValid = validStatuses.includes(tracking.status);
    const sentByCarrier = ["posted", "in_transit", "delivered"].includes(tracking.status);

    let message = "";
    switch (tracking.status) {
      case "pending":
        message = "Etiqueta no carrinho do Melhor Envio, ainda não paga.";
        break;
      case "released":
        message = "Etiqueta paga. Aguardando geração/impressão.";
        break;
      case "generated":
        message = "Etiqueta gerada. Aguardando postagem na transportadora.";
        break;
      case "posted":
      case "in_transit":
        message = "Pacote foi postado na transportadora e está em trânsito.";
        break;
      case "undelivered":
        message = "Transportadora não conseguiu entregar o pacote.";
        break;
      case "delivered":
        message = "Pacote entregue com sucesso!";
        break;
      case "canceled":
      case "cancelled":
        message = "Etiqueta foi cancelada. Contate o suporte.";
        break;
      case "exception":
        message = "Houve um problema com a etiqueta. Contate o suporte.";
        break;
      default:
        message = `Status desconhecido: ${tracking.status}`;
    }

    return {
      valid: isValid,
      status: tracking.status,
      message,
      sentByCarrier,
    };
  } catch (error) {
    console.error("[ME API] Validation error:", error);
    return {
      valid: false,
      status: "error",
      message: "Erro ao validar etiqueta",
      sentByCarrier: false,
    };
  }
}
