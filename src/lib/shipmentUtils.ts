import { prisma } from "@/lib/prisma";
import { createMelhorEnvioShipment, MelhorEnvioShipmentPayload } from "@/lib/melhorEnvio";
import { sendShippingConfirmationEmail } from "@/lib/email";

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

    // Get sender (store) info from settings
    if (!settings?.freteLocalCidade || !settings?.freteLocalUF) {
      console.warn(`Order ${order.orderNumber} missing sender city/state info`);
      return;
    }

    // Formatar payload para Melhor Envio
    const payload: MelhorEnvioShipmentPayload = {
      service: parseInt(order.shippingMethod),
      from: {
        name: settings.name || "Loja",
        phone: settings.whatsapp?.replace(/\D/g, "") || "0000000000",
        email: process.env.SMTP_USER || "noreply@store.com",
        address: settings.address || "Endereço não informado",
        number: "S/N",
        district: "Centro",
        city: settings.freteLocalCidade,
        postal_code: settings.freteCEPOrigem?.replace(/\D/g, "") || "00000000",
        state_abbr: settings.freteLocalUF,
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

    // Sender info for API
    const senderInfo = payload.from;

    // Criar shipment no Melhor Envio
    const shipment = await createMelhorEnvioShipment(settings.melhorEnvioToken, payload, senderInfo);

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
