export interface MelhorEnvioShipmentPayload {
  service: number;
  from: {
    name: string;
    phone: string;
    email: string;
    address: string;
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
    address: string;
    number: string;
    district: string;
    city: string;
    postal_code: string;
    state_abbr: string;
    country_id: string;
  };
  products: Array<{
    name: string;
    quantity: number;
    unitary_value: number;
  }>;
  volumes: Array<{
    height: number;
    width: number;
    length: number;
    weight: number;
  }>;
  options?: {
    insurance_value?: number;
    receipt?: boolean;
    own_hand?: boolean;
    reverse?: boolean;
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
    const cartPayload = {
      service: payload.service,
      from: senderInfo,
      to: payload.to,
      products: payload.products,
      volumes: payload.volumes,
      options: payload.options || {},
    };

    console.log("[ME API] Cart URL: https://api.melhorenvio.com.br/api/v2/me/cart");
    console.log("[ME API] Token: " + (token ? token.substring(0, 20) + "..." : "MISSING"));
    console.log("[ME API] Cart Payload:", JSON.stringify(cartPayload, null, 2));

    const cartRes = await fetch("https://api.melhorenvio.com.br/api/v2/me/cart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "VirtualClothingStore/1.0",
      },
      body: JSON.stringify(cartPayload),
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
    const checkoutRes = await fetch("https://api.melhorenvio.com.br/api/v2/me/shipment/checkout", {
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
