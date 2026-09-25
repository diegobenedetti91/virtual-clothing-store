import { prisma } from "./prisma";
import { sincronizarClienteComBling } from "./blingSync";

interface BlingPedidoV3 {
  numero: string;
  data: string;
  contato: {
    id?: string | number;
    nome?: string;
    email?: string;
    telefone?: string;
    tipoPessoa?: "F" | "J";
    numeroDocumento?: string;
  };
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
    produto?: {
      id: string;
    };
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

async function obterContatoBlingPorCPFCNPJ(token: string, cpfCnpj: string): Promise<string | null> {
  try {
    if (!cpfCnpj) return null;

    const cpfCnpjLimpo = cpfCnpj.replace(/\D/g, "");
    const response = await fetch(
      `https://api.bling.com.br/Api/v3/contatos?numeroDocumento=${cpfCnpjLimpo}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data.data?.length > 0) {
      const contatoId = data.data[0].id;
      console.log(`[Bling] Contato encontrado: ${cpfCnpjLimpo} -> ID: ${contatoId}`);
      return String(contatoId);
    }

    return null;
  } catch (error) {
    console.error("[Bling] Erro ao buscar contato:", error);
    return null;
  }
}

async function obterTokenAutomatico(settings: { blingClientId: string | null; blingClientSecret: string | null; blingAccessToken?: string | null; blingRefreshToken?: string | null; blingTokenExpiresAt?: Date | null }): Promise<string | null> {
  try {
    if (!settings.blingAccessToken) {
      console.error("[Bling] Nenhum token salvo. Usuário precisa autorizar no Bling.");
      return null;
    }

    if (settings.blingTokenExpiresAt && new Date() < settings.blingTokenExpiresAt) {
      console.log("[Bling] Token válido, usando token armazenado");
      return settings.blingAccessToken;
    }

    if (!settings.blingRefreshToken) {
      console.error("[Bling] Token expirado mas sem refresh_token para renovar");
      return null;
    }

    console.log("[Bling] Token expirado, renovando com refresh_token...");
    const basicAuth = Buffer.from(
      `${settings.blingClientId}:${settings.blingClientSecret}`
    ).toString("base64");

    const response = await fetch("https://api.bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "1.0",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: settings.blingRefreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Bling] Erro ao renovar token:", error);
      return null;
    }

    const tokenData = await response.json();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    await prisma.companySettings.update({
      where: { id: (await prisma.companySettings.findFirst({ where: { blingClientId: settings.blingClientId } }))?.id || "" },
      data: {
        blingAccessToken: tokenData.access_token,
        blingRefreshToken: tokenData.refresh_token,
        blingTokenExpiresAt: expiresAt,
      },
    });

    console.log("[Bling] Token renovado com sucesso");
    return tokenData.access_token;
  } catch (error) {
    console.error("[Bling] Exceção ao obter token:", error);
    return null;
  }
}

export async function integrarPedidoBling(orderId: string): Promise<{ success: boolean; error?: string; blingId?: string }> {
  try {
    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });

    if (!settings?.blingClientId || !settings?.blingClientSecret) {
      return { success: false, error: "Credenciais do Bling não configuradas" };
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    }) as any;

    if (!order) {
      return { success: false, error: "Pedido não encontrado" };
    }

    if (order.blingIntegrationStatus === "success") {
      return { success: true, blingId: order.blingPedidoId || undefined };
    }

    const accessToken = await obterTokenAutomatico(settings);
    if (!accessToken) {
      return { success: false, error: "Não foi possível obter token do Bling. Autorize via configurações primeiro." };
    }

    const cpfCnpj = order.cpfCnpj ? order.cpfCnpj.replace(/\D/g, "") : "";
    const customerCpfCnpj = order.customer?.cpfCnpj || cpfCnpj;
    const tipoPessoa = cpfCnpj.length === 14 ? "J" : "F";

    let contatoId: string | undefined;

    if (customerCpfCnpj) {
      const blingContatoId = await obterContatoBlingPorCPFCNPJ(accessToken, customerCpfCnpj);
      if (blingContatoId) {
        contatoId = blingContatoId;
      } else if (order.customer?.blingContatoId) {
        contatoId = order.customer.blingContatoId;
      } else if (order.customer?.id) {
        console.warn("[Bling] Cliente não encontrado no Bling, tentando sincronizar automaticamente");
        const syncSuccess = await sincronizarClienteComBling(order.customer.id);

        if (syncSuccess) {
          const blingContatoIdRetry = await obterContatoBlingPorCPFCNPJ(accessToken, customerCpfCnpj);
          if (blingContatoIdRetry) {
            contatoId = blingContatoIdRetry;
          } else {
            const updatedCustomer = await prisma.customerUser.findUnique({
              where: { id: order.customer.id },
              select: { blingContatoId: true }
            });
            if (updatedCustomer?.blingContatoId) {
              contatoId = updatedCustomer.blingContatoId;
            } else {
              console.error("[Bling] Falha ao sincronizar cliente. Abortar integração de pedido.");
              return { success: false, error: "Falha ao sincronizar cliente com Bling. Tente novamente." };
            }
          }
        } else {
          console.error("[Bling] Cliente não pôde ser sincronizado no Bling. Abortar integração.");
          return { success: false, error: "Cliente não pôde ser sincronizado no Bling. Sincronize manualmente." };
        }
      }
    }

    const blingData: BlingPedidoV3 = {
      numero: order.orderNumber,
      data: order.createdAt.toISOString().split("T")[0],
      contato: {
        id: contatoId || undefined,
        nome: order.customerName,
        email: order.customer?.email || order.customerEmail || undefined,
        telefone: order.customer?.phone || order.customerPhone || undefined,
        tipoPessoa: cpfCnpj ? tipoPessoa : undefined,
        numeroDocumento: customerCpfCnpj || undefined,
      },
      observacoes: order.notes || `Pedido ${order.orderNumber} - Cliente: ${order.customerName}`,
      itens: order.items.map((item: any) => ({
        codigo: item.product.id,
        descricao: item.product.name,
        quantidade: item.quantity,
        valor: item.price,
        unidade: "UN",
        produto: {
          id: item.blingProdutoId || item.product.id,
        },
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
        "Authorization": `Bearer ${accessToken}`,
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
