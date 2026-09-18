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

    // Se aprovar, fazer estorno de pagamento e restaurar estoque
    if (status === "APPROVED" && updated.refundAmount > 0) {
      const refundResult = await refundPartialPayment(returnData.order.orderNumber, updated.refundAmount);
      
      if (refundResult.success) {
        // Restaurar estoque dos itens devolvidos
        const returnedItemIds = Array.isArray(updated.returnedItems) ? updated.returnedItems : 
                                (typeof updated.returnedItems === 'string' ? JSON.parse(updated.returnedItems) : []);
        
        const itemsToRestore = returnData.order.items.filter((item: any) => 
          returnedItemIds.some((ri: any) => ri.itemId === item.id)
        );
        
        if (itemsToRestore.length > 0) {
          await restoreOrderStock(itemsToRestore).catch(console.error);
        }
        
        // Atualizar com data de reembolso
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
