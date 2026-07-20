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

    // Formatar payload para Melhor Envio
    const payload: MelhorEnvioShipmentPayload = {
      service: parseInt(order.shippingMethod),
      recipient: {
        name: order.customerName,
        phone: order.customerPhone.replace(/\D/g, ""),
        email: order.customerEmail || "noreply@store.com",
        address: order.address,
        number: "S/N",
        city: order.city,
        state: order.state,
        postal_code: order.zipCode.replace(/\D/g, ""),
      },
      items: order.items.map((item) => ({
        name: item.product.name.substring(0, 100),
        quantity: item.quantity,
        unitary_value: item.price,
      })),
      insurance_value: order.subtotal,
      value: order.shippingCost,
    };

    // Criar shipment no Melhor Envio
    const shipment = await createMelhorEnvioShipment(settings.melhorEnvioToken, payload);

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
