import { prisma } from "./prisma";

async function obterTokenBling(): Promise<string | null> {
  const settings = await prisma.companySettings.findFirst();

  if (!settings) {
    console.warn("[Bling] Nenhuma configuração de empresa encontrada");
    return null;
  }

  if (!settings.blingAtivo) {
    console.warn("[Bling] Bling não está ativado nas configurações");
    return null;
  }

  if (!settings.blingAccessToken) {
    console.warn("[Bling] Nenhum token de acesso configurado");
    return null;
  }

  if (settings.blingTokenExpiresAt && new Date() < settings.blingTokenExpiresAt) {
    console.log("[Bling] Token válido, usando token armazenado");
    return settings.blingAccessToken;
  }

  if (!settings.blingRefreshToken) {
    console.warn("[Bling] Token expirado mas sem refresh_token para renovar");
    return null;
  }

  try {
    console.log("[Bling] Token expirado, renovando com refresh_token...");
    const basicAuth = Buffer.from(
      `${settings.blingClientId}:${settings.blingClientSecret}`
    ).toString("base64");

    const response = await fetch("https://api.bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: settings.blingRefreshToken,
      }).toString(),
    });

    if (!response.ok) {
      console.error("[Bling] Erro ao renovar token. Status:", response.status);
      return null;
    }

    const tokenData = await response.json();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);

    await prisma.companySettings.update({
      where: { id: settings.id },
      data: {
        blingAccessToken: tokenData.access_token,
        blingRefreshToken: tokenData.refresh_token,
        blingTokenExpiresAt: expiresAt,
      },
    });

    console.log("[Bling] Token renovado com sucesso");
    return tokenData.access_token;
  } catch (err) {
    console.error("[Bling] Erro ao obter token:", err);
    return null;
  }
}

export async function sincronizarProdutoComBling(productId: string): Promise<boolean> {
  try {
    const token = await obterTokenBling();
    if (!token) return false;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });

    if (!product) return false;

    const imagens = JSON.parse(product.images || "[]") as string[];
    const pesoGramas = product.pesoGramas || 0;
    const pesoKg = pesoGramas / 1000;

    const blingProduct = {
      id: product.id,
      nome: product.name,
      codigo: product.slug,
      preco: product.price,
      tipo: "P",
      situacao: product.active ? "A" : "I",
      formato: "S",
      descricaoCurta: product.description || product.name,
      unidade: "UN",
      pesoLiquido: pesoKg || undefined,
      pesoBruto: pesoKg || undefined,
      estoque: {
        maximo: product.stock || 0,
      },
      categoria: {
        id: product.categoryId,
      },
      midia: imagens.length > 0 ? {
        imagens: {
          imagensURL: imagens.map((img) => ({ link: img })),
        },
      } : undefined,
    };

    let blingId = product.blingProdutoId;
    let isUpdate = false;

    if (!blingId) {
      const searchResponse = await fetch(
        `https://api.bling.com.br/Api/v3/produtos?codigos%5B%5D=${encodeURIComponent(product.slug)}`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data?.length > 0) {
          blingId = String(searchData.data[0].id);
          isUpdate = true;
          console.log(`[Bling] Produto encontrado: ${product.name} (ID: ${blingId})`);

          await prisma.product.update({
            where: { id: productId },
            data: { blingProdutoId: blingId },
          });
        }
      }
    } else {
      isUpdate = true;
    }

    const method = isUpdate ? "PUT" : "POST";
    const url = isUpdate
      ? `https://api.bling.com.br/Api/v3/produtos/${blingId}`
      : "https://api.bling.com.br/Api/v3/produtos";

    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(blingProduct),
    });

    if (response.ok) {
      const data = await response.json();
      const returnedBlingId = data.data?.id || blingId;
      if (returnedBlingId && !product.blingProdutoId) {
        await prisma.product.update({
          where: { id: productId },
          data: { blingProdutoId: String(returnedBlingId) },
        });
      }
      console.log(`[Bling] Produto ${isUpdate ? "atualizado" : "criado"}: ${product.name} (ID: ${returnedBlingId})`);
      return true;
    }

    const error = await response.text();
    console.error(`[Bling] Erro ao sincronizar produto ${product.name}:`, error);
    return false;
  } catch (error) {
    console.error("[Bling] Erro ao sincronizar produto:", error);
    return false;
  }
}

export async function sincronizarClienteComBling(customerId: string): Promise<boolean> {
  try {
    console.log("[Bling] Iniciando sincronização de cliente:", customerId);
    const token = await obterTokenBling();
    if (!token) {
      console.warn("[Bling] Token não disponível. Bling pode não estar ativado ou configurado.");
      return false;
    }

    const customer = await prisma.customerUser.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      console.error("[Bling] Cliente não encontrado no banco:", customerId);
      return false;
    }

    const cpfCnpj = customer.cpfCnpj ? customer.cpfCnpj.replace(/\D/g, "") : "";
    const tipo = cpfCnpj.length === 14 ? "J" : "F";

    // Montar endereço apenas se todos os campos essenciais forem preenchidos
    // Bling valida cidades e pode rejeitar se não encontrar, então é mais seguro enviar sem
    // endereço do que com dados incompletos
    let endereco = undefined;
    if (customer.street && customer.city && customer.state && customer.neighborhood) {
      endereco = {
        geral: {
          endereco: customer.street.substring(0, 100) || "",
          numero: (customer.number || "0").substring(0, 20),
          bairro: customer.neighborhood.substring(0, 50) || "",
          municipio: customer.city.substring(0, 50) || "",
          uf: customer.state.substring(0, 2) || "",
          cep: (customer.zipCode || "").replace(/\D/g, "").substring(0, 8) || "",
        },
      };
      console.log("[Bling] Incluindo endereço:", endereco);
    } else {
      console.warn("[Bling] Campos de endereço incompletos, enviando contato sem endereço");
    }

    const blingContato = {
      nome: customer.name,
      codigo: customer.id,
      situacao: "A",
      tipo,
      numeroDocumento: cpfCnpj || undefined,
      telefone: customer.phone || undefined,
      email: customer.email || undefined,
      ...(endereco ? { endereco } : {}),
      tiposContato: [
        {
          id: customer.id,
          descricao: "Cliente",
        },
      ],
    };

    const response = await fetch("https://api.bling.com.br/Api/v3/contatos", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(blingContato),
    });

    if (response.ok) {
      const data = await response.json();
      const blingId = data.data?.id;

      if (blingId) {
        await prisma.customerUser.update({
          where: { id: customerId },
          data: { blingContatoId: String(blingId) },
        });
        console.log(`[Bling] Cliente ${customer.name} sincronizado com ID: ${blingId}`);
        return true;
      } else {
        console.error("[Bling] Nenhum ID de contato encontrado na resposta:", JSON.stringify(data));
        return false;
      }
    }

    const error = await response.text();
    console.error(`[Bling] Erro ao sincronizar cliente ${customer.name}:`, error);
    return false;
  } catch (error) {
    console.error("[Bling] Erro ao sincronizar cliente:", error);
    return false;
  }
}
