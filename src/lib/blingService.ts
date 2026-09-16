import { prisma } from "./prisma";

export interface BlingPedidoData {
  numero: string;
  serie: number;
  cliente: {
    nome: string;
    telefone?: string;
    email?: string;
  };
  endereco: {
    endereco: string;
    numero: string;
    complemento?: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
  itens: Array<{
    descricao: string;
    quantidade: number;
    valorunitario: number;
  }>;
  valor: number;
  observacoes?: string;
}

export async function integrarPedidoBling(orderId: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
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
      return { success: true };
    }

    const blingData: BlingPedidoData = {
      numero: order.orderNumber,
      serie: 1,
      cliente: {
        nome: order.customerName,
        telefone: order.customerPhone,
        email: order.customerEmail || undefined,
      },
      endereco: {
        endereco: order.address || "Não informado",
        numero: order.streetNumber || "0",
        complemento: undefined,
        bairro: order.neighborhood || "Não informado",
        municipio: order.city || "Não informado",
        uf: order.state || "SP",
        cep: order.zipCode?.replace(/\D/g, "") || "00000000",
      },
      itens: order.items.map((item) => ({
        descricao: item.product.name,
        quantidade: item.quantity,
        valorunitario: item.price,
      })),
      valor: order.total,
      observacoes: order.notes || undefined,
    };

    const response = await fetch("https://bling.com.br/Api/v2/pedido/json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pedido: blingData,
        apikey: apiKey,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Erro ao integrar com Bling:", error);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.retorno?.pedidos?.[0]?.pedido) {
      const blingPedido = result.retorno.pedidos[0].pedido;
      await prisma.order.update({
        where: { id: orderId },
        data: {
          blingPedidoId: String(blingPedido.id),
          blingIntegrationStatus: "success",
          blingIntegratedAt: new Date(),
        },
      });
      return { success: true };
    } else {
      const erros = result.retorno?.erros?.map((e: any) => e.erro?.mensagem).join("; ") || "Erro desconhecido";
      return { success: false, error: erros };
    }
  } catch (error) {
    console.error("Erro ao integrar pedido com Bling:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" };
  }
}
