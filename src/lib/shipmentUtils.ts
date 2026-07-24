import { prisma } from "@/lib/prisma";
import { createMelhorEnvioShipment, MelhorEnvioShipmentPayload } from "@/lib/melhorEnvio";
import { sendShippingConfirmationEmail } from "@/lib/email";

// Parse address like "Rua Tancredo de Luna, 780 - Vila Residencial Treviso, Limeira - SP"
function parseAddress(fullAddress: string) {
  const parts = fullAddress.split(",").map((p) => p.trim());

  let street = "";
  let number = "";
  let district = "";
  let city = "";
  let state = "";

  if (parts.length >= 1) {
    // Extract street and number from first part: "Rua X 123" or "Rua X, 123"
    const streetParts = parts[0].split(/\s+(?=\d)/).map((p) => p.trim());
    if (streetParts.length >= 2) {
      street = streetParts[0];
      number = streetParts[1];
    } else {
      street = parts[0];
      number = "S/N";
    }
  }

  if (parts.length >= 2) {
    // Second part might be: "123 - Bairro" or just "123"
    const secondPart = parts[1];
    const dashIndex = secondPart.indexOf("-");
    if (dashIndex > 0) {
      district = secondPart.substring(dashIndex + 1).trim();
      const numPart = secondPart.substring(0, dashIndex).trim();
      if (!number || number === "S/N") {
        number = numPart;
      }
    } else {
      number = secondPart;
    }
  }

  if (parts.length >= 3) {
    // Third part is city and state: "Limeira - SP" or "Limeira SP"
    const cityStatePart = parts[2];
    const dashIndex = cityStatePart.indexOf("-");
    if (dashIndex > 0) {
      city = cityStatePart.substring(0, dashIndex).trim();
      state = cityStatePart.substring(dashIndex + 1).trim();
    } else {
      const cityStateParts = cityStatePart.split(/\s+/);
      city = cityStateParts[0];
      state = cityStateParts[1] || "SP";
    }
  }

  return { street, number, district: district || "Centro", city, state };
}

export async function createAutomaticShipment(orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    // Verificar se já tem shipment
    if (order.melhorEnvioShipmentId) {
      console.log(`Order ${order.orderNumber} already has a shipment`);
      return;
    }

    const settings = await prisma.companySettings.findFirst();

    if (!settings?.melhorEnvioToken) {
      console.warn("Melhor Envio token not configured - shipment creation skipped");
      return;
    }

    // Validar dados necessários
    if (!order.shippingMethod || !order.address || !order.city || !order.state || !order.zipCode) {
      console.warn(`Order ${order.orderNumber} missing shipping data`);
      return;
    }

    // Get sender (store) info from settings - parse address if available
    let senderAddressInfo = {
      street: "Avenida Paulista",
      number: "1000",
      district: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    };

    if (settings?.address) {
      senderAddressInfo = parseAddress(settings.address);
    } else if (settings?.freteLocalCidade && settings?.freteLocalUF) {
      senderAddressInfo.city = settings.freteLocalCidade;
      senderAddressInfo.state = settings.freteLocalUF;
    }

    const senderCEP = settings?.freteCEPOrigem || "01310100";

    // Formatar payload para Melhor Envio
    const payload: MelhorEnvioShipmentPayload = {
      service: parseInt(order.shippingMethod),
      from: {
        name: settings.name || "Loja",
        phone: settings.whatsapp?.replace(/\D/g, "") || "1133334444",
        email: process.env.SMTP_USER || "noreply@store.com",
        address: senderAddressInfo.street,
        number: senderAddressInfo.number,
        district: senderAddressInfo.district,
        city: senderAddressInfo.city,
        postal_code: senderCEP.replace(/\D/g, ""),
        state_abbr: senderAddressInfo.state,
      },
      to: {
        name: order.customerName,
        phone: order.customerPhone.replace(/\D/g, ""),
        email: order.customerEmail || "noreply@store.com",
        address: order.address || "Endereço não informado",
        number: "S/N",
        district: "Centro",
        city: order.city,
        postal_code: order.zipCode.replace(/\D/g, ""),
        state_abbr: order.state,
        country_id: "BR",
      },
      products: order.items.map((item) => ({
        name: item.product.name.substring(0, 100),
        quantity: item.quantity,
        unitary_value: item.price,
      })),
      volumes: [
        {
          height: settings.fretePacoteAltura || 5,
          width: settings.fretePacoteLargura || 12,
          length: settings.fretePacoteComprimento || 17,
          weight: (order.items.reduce((sum, item) => sum + (item.product.pesoGramas || 500) * item.quantity, 0) / 1000) || 1,
        },
      ],
      options: {
        insurance_value: order.subtotal,
        receipt: false,
        own_hand: false,
        reverse: false,
      },
    };

    // Criar shipment no Melhor Envio
    const shipment = await createMelhorEnvioShipment(settings.melhorEnvioToken, payload, payload.from);

    // Armazenar dados no banco
    await prisma.order.update({
      where: { id: orderId },
      data: {
        melhorEnvioShipmentId: shipment.id,
        trackingCode: shipment.tracking,
        trackingUrl: shipment.tracking_url,
        etiquetaUrl: shipment.label_url,
        shipmentStatus: "posted",
        lastTrackingUpdate: new Date(),
      },
    });

    console.log(
      `Shipment created for order ${order.orderNumber}: ${shipment.tracking}`
    );

    // Enviar email ao cliente com rastreamento
    if (order.customerEmail) {
      await sendShippingConfirmationEmail({
        to: order.customerEmail,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        trackingCode: shipment.tracking,
        trackingUrl: shipment.tracking_url,
        storeName: settings.name || "Minha Loja",
      }).catch((err) => {
        console.error("Failed to send shipping confirmation email:", err);
      });
    }

    return shipment;
  } catch (error) {
    console.error(`Failed to create shipment for order ${orderId}:`, error);

    // Tentar salvar erro na nota do pedido
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, notes: true },
      });
      if (order) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await prisma.order.update({
          where: { id: orderId },
          data: {
            notes: (order.notes || "") + `\n[ERRO SHIPMENT] ${errorMsg}`,
          },
        });
      }
    } catch (e) {
      console.error("Failed to log shipment error:", e);
    }

    throw error;
  }
}
