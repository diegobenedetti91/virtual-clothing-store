export interface MelhorEnvioShipmentPayload {
  service: number;
  recipient: {
    name: string;
    phone: string;
    email: string;
    address: string;
    number: string;
    complement?: string;
    city: string;
    state: string;
    postal_code: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitary_value: number;
  }>;
  insurance_value: number;
  value: number;
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
  payload: MelhorEnvioShipmentPayload
): Promise<MelhorEnvioShipmentResponse> {
  const res = await fetch("https://melhorenvio.com.br/api/v2/me/shipment/create", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "VirtualClothingStore/1.0",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("Melhor Envio error:", error);
    throw new Error(`Melhor Envio error: ${res.status} ${res.statusText}`);
  }

  return res.json();
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
