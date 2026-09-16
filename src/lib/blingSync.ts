import { prisma } from "./prisma";

async function obterTokenBling(): Promise<string | null> {
  const settings = await prisma.companySettings.findFirst();

  if (!settings?.blingAccessToken || !settings?.blingAtivo) {
    return null;
  }

  if (settings.blingTokenExpiresAt && new Date() < settings.blingTokenExpiresAt) {
    return settings.blingAccessToken;
  }

  if (!settings.blingRefreshToken) {
    return null;
  }

  try {
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

    if (!response.ok) return null;

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

    return tokenData.access_token;
  } catch {
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

    const response = await fetch("https://api.bling.com.br/Api/v3/produtos", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(blingProduct),
    });

    console.log(`[Bling] Produto ${product.name} sincronizado:`, response.ok);
    return response.ok;
  } catch (error) {
    console.error("[Bling] Erro ao sincronizar produto:", error);
    return false;
  }
}

export async function sincronizarClienteComBling(customerId: string): Promise<boolean> {
  try {
    const token = await obterTokenBling();
    if (!token) return false;

    const customer = await prisma.customerUser.findUnique({
      where: { id: customerId },
    });

    if (!customer) return false;

    const cpfCnpj = customer.cpfCnpj ? customer.cpfCnpj.replace(/\D/g, "") : "";
    const tipo = cpfCnpj.length === 14 ? "J" : "F";

    const blingContato = {
      nome: customer.name,
      codigo: customer.id,
      situacao: "A",
      tipo,
      numeroDocumento: cpfCnpj || undefined,
      telefone: customer.phone || undefined,
      email: customer.email || undefined,
      endereco: customer.city || customer.neighborhood ? {
        geral: {
          endereco: customer.street || "",
          numero: customer.number || "0",
          bairro: customer.neighborhood || "",
          municipio: customer.city || "",
          uf: customer.state || "",
          cep: customer.zipCode || "",
        },
      } : undefined,
      tiposContato: [
        {
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
      console.log("[Bling] Resposta do cadastro de cliente:", JSON.stringify(data, null, 2));

      const blingId = data.data?.id || data.data?.contato?.id || data.id || data.contato?.id;
      if (blingId) {
        await prisma.customerUser.update({
          where: { id: customerId },
          data: { blingContatoId: String(blingId) },
        });
        console.log(`[Bling] Cliente ${customer.name} sincronizado com ID: ${blingId}`);
      } else {
        console.warn("[Bling] Nenhum ID de contato encontrado na resposta");
      }
      return true;
    }

    const error = await response.text();
    console.log(`[Bling] Erro ao sincronizar cliente ${customer.name}:`, error);
    return false;
  } catch (error) {
    console.error("[Bling] Erro ao sincronizar cliente:", error);
    return false;
  }
}
