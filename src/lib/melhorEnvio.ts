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
}

export interface MelhorEnvioTrackingResponse {
  id: string;
  status: string;
  timeline?: Array<{
    status: string;
    location: string;
    date: string;
    detail: string;
  }>;
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
      throw new Error(`Melhor Envio cart error: ${cartRes.status}`);
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
      throw new Error(`Melhor Envio checkout error: ${checkoutRes.status}`);
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
  const res = await fetch(
    `https://melhorenvio.com.br/api/v2/me/shipment/${shipmentId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "VirtualClothingStore/1.0",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch tracking: ${res.status}`);
  }

  return res.json();
}
