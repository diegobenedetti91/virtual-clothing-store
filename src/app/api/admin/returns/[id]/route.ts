import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReturnDecisionEmail } from "@/lib/email";
import { refundPartialPayment } from "@/lib/refundUtils";
import { restoreOrderStock } from "@/lib/stockUtils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const returnData = await prisma.return.findUnique({
      where: { id },
      include: {
        order: {
          include: { items: { include: { product: true } } },
        },
        customer: true,
      },
    });

    if (!returnData) {
      return NextResponse.json({ error: "Devolução não encontrada" }, { status: 404 });
    }

    return NextResponse.json(returnData);
  } catch (error) {
    console.error("[admin/returns/[id]] GET error:", error);
    return NextResponse.json({ error: "Erro ao buscar devolução" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { status, adminNotes, images } = await req.json();

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });
    }

    const returnData = await prisma.return.findUnique({
      where: { id },
      include: { 
        order: { include: { items: true } }, 
        customer: true 
      },
    });

    if (!returnData) {
      return NextResponse.json({ error: "Devolução não encontrada" }, { status: 404 });
    }

    const updated = await prisma.return.update({
      where: { id },
      data: {
        status,
        adminNotes: adminNotes || null,
        images: images ? JSON.stringify(images) : null,
        responseDate: new Date(),
      },
      include: {
        order: true,
        customer: true,
      },
    });

    // Se aprovar, restaurar estoque e fazer estorno de pagamento
    if (status === "APPROVED") {
      // Restaurar estoque dos itens devolvidos (com quantidade correta)
      const returnedItemIds = Array.isArray(updated.returnedItems) ? updated.returnedItems : 
                              (typeof updated.returnedItems === 'string' ? JSON.parse(updated.returnedItems) : []);
      
      // Mapear quantidade devolvida de cada item
      const itemsToRestore = returnedItemIds
        .map((returnedItem: any) => {
          const orderItem = returnData.order.items.find((oi: any) => oi.id === returnedItem.itemId);
          if (!orderItem) return null;
          return {
            productId: orderItem.productId,
            quantity: returnedItem.quantity, // Quantidade devolvida, não total
            size: orderItem.size,
            color: orderItem.color,
            selectedAttributes: orderItem.selectedAttributes,
          };
        })
        .filter(Boolean);
      
      if (itemsToRestore.length > 0) {
        await restoreOrderStock(itemsToRestore).catch(console.error);
      }
      
      // Fazer estorno de pagamento se houver valor e gateway configurado
      if (updated.refundAmount > 0 && returnData.order.paymentGateway && 
          (returnData.order.paymentGateway === "mercadopago" || returnData.order.paymentGateway === "nupay")) {
        const refundResult = await refundPartialPayment(returnData.order.orderNumber, updated.refundAmount);
        
        if (refundResult.success) {
          // Atualizar com data de reembolso
          await prisma.return.update({
            where: { id },
            data: { refundedAt: new Date() }
          }).catch(console.error);
        } else {
          console.warn("[admin/returns] Refund failed:", refundResult.message);
        }
      } else if (updated.refundAmount > 0 && (!returnData.order.paymentGateway || returnData.order.paymentGateway === "whatsapp")) {
        // Para WhatsApp ou sem gateway, apenas marcar como refundado (refund é manual)
        await prisma.return.update({
          where: { id },
          data: { refundedAt: new Date() }
        }).catch(console.error);
      }
    }

    // Enviar email ao cliente (non-blocking)
    const settings = await prisma.companySettings.findFirst();
    const storeName = settings?.name || "Loja";

    if (returnData.customer.email) {
      sendReturnDecisionEmail({
        to: returnData.customer.email,
        customerName: returnData.customer.name,
        orderNumber: returnData.order.orderNumber,
        approved: status === "APPROVED",
        storeName,
        adminNotes,
        images: images && images.length > 0 ? images : undefined,
      }).catch(console.error);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[admin/returns/[id]] PATCH error:", error);
    return NextResponse.json({ error: "Erro ao atualizar devolução" }, { status: 500 });
  }
}
