import { prisma } from "./prisma";

interface BlingPedidoV3 {
  numero: string;
  data: string;
  desconto?: {
    valor: number;
    unidade: "REAL" | "PERCENTUAL";
  };
  observacoes?: string;
  itens: Array<{
    codigo?: string;
    descricao: string;
    quantidade: number;
    valor: number;
    unidade?: string;
  }>;
  transporte?: {
    frete: number;
    etiqueta?: {
      nome: string;
      endereco: string;
      numero: string;
      complemento?: string;
      municipio: string;
      uf: string;
      cep: string;
      bairro: string;
    };
  };
}

export async function integrarPedidoBling(orderId: string, apiKey: string): Promise<{ success: boolean; error?: string; blingId?: string }> {
  if (!apiKey) {
    return { success: false, error: "API Key de Bling não configurada" };
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      return { success: false, error: "Pedido não encontrado" };
    }

    if (order.blingIntegrationStatus === "success") {
      return { success: true, blingId: order.blingPedidoId || undefined };
    }

    const blingData: BlingPedidoV3 = {
      numero: order.orderNumber,
      data: order.createdAt.toISOString().split("T")[0],
      observacoes: order.notes || `Pedido ${order.orderNumber} - Cliente: ${order.customerName}`,
      itens: order.items.map((item) => ({
        descricao: item.product.name,
        quantidade: item.quantity,
        valor: item.price,
        unidade: "UN",
      })),
    };

    if (order.shippingCost && order.shippingCost > 0) {
      blingData.transporte = {
        frete: order.shippingCost,
        etiqueta: {
          nome: order.customerName,
          endereco: order.address || "Não informado",
          numero: order.streetNumber || "0",
          complemento: undefined,
          municipio: order.city || "Não informado",
          uf: order.state || "SP",
          cep: order.zipCode?.replace(/\D/g, "") || "00000000",
          bairro: order.neighborhood || "Não informado",
        },
      };
    }

    console.log("[Bling] Enviando pedido para API v3:", JSON.stringify(blingData, null, 2));

    const response = await fetch("https://api.bling.com.br/Api/v3/pedidos/vendas", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(blingData),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Bling] Erro ao integrar:", error);
      return { success: false, error: `HTTP ${response.status}: ${error}` };
    }

    const result = await response.json();
    console.log("[Bling] Resposta da API:", JSON.stringify(result, null, 2));

    if (result.data?.id) {
      const blingPedidoId = String(result.data.id);
      await prisma.order.update({
        where: { id: orderId },
        data: {
          blingPedidoId,
          blingIntegrationStatus: "success",
          blingIntegratedAt: new Date(),
        },
      });
      console.log("[Bling] Pedido integrado com sucesso:", blingPedidoId);
      return { success: true, blingId: blingPedidoId };
    } else if (result.errors) {
      const erros = Array.isArray(result.errors) ? result.errors.join("; ") : JSON.stringify(result.errors);
      console.error("[Bling] Erros na resposta:", erros);
      return { success: false, error: erros };
    } else {
      return { success: false, error: "Resposta inválida da API Bling" };
    }
  } catch (error) {
    console.error("[Bling] Exceção ao integrar pedido:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" };
  }
}
