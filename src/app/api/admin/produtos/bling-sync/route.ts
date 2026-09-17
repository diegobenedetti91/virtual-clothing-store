import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function obterTokenBling(settings: any): Promise<string | null> {
  if (!settings.blingAccessToken) {
    console.error("[Bling] Sem token salvo");
    return null;
  }

  if (settings.blingTokenExpiresAt && new Date() < settings.blingTokenExpiresAt) {
    return settings.blingAccessToken;
  }

  if (!settings.blingRefreshToken) {
    return null;
  }

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
}

export async function POST(req: NextRequest) {
  try {
    const settings = await prisma.companySettings.findFirst();

    if (!settings?.blingAtivo || !settings?.blingAccessToken) {
      return NextResponse.json(
        { error: "Bling não está configurado" },
        { status: 400 }
      );
    }

    const token = await obterTokenBling(settings);
    if (!token) {
      return NextResponse.json(
        { error: "Erro ao obter token Bling" },
        { status: 401 }
      );
    }

    const products = await prisma.product.findMany({
      where: { active: true },
      include: { category: true },
    });

    let sincronizados = 0;
    let erros = 0;
    const delayMs = 800; // 800ms = ~1.25 req/s (limite 3 req/s, mas cada produto faz 2 requisições)

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      // Adiciona delay entre requisições (exceto na primeira)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      try {
        const imagens = JSON.parse(product.images || "[]") as string[];
        const pesoGramas = product.pesoGramas || 0;
        const pesoKg = pesoGramas / 1000;

        const blingProductPayload = {
          id: product.id,
          nome: product.name,
          codigo: product.slug,
          preco: product.price,
          tipo: "P",
          situacao: "A",
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
              console.log(`[Bling] Produto encontrado no Bling: ${product.name} (ID: ${blingId})`);

              await prisma.product.update({
                where: { id: product.id },
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
          body: JSON.stringify(blingProductPayload),
        });

        if (response.ok) {
          sincronizados++;
          const data = await response.json();
          const returnedBlingId = data.data?.id || blingId;

          if (returnedBlingId && !product.blingProdutoId) {
            await prisma.product.update({
              where: { id: product.id },
              data: { blingProdutoId: String(returnedBlingId) },
            });
          }

          console.log(`[Bling] Produto ${isUpdate ? "atualizado" : "criado"}: ${product.name} (ID: ${returnedBlingId})`);
        } else {
          erros++;
          const error = await response.text();
          console.error(`[Bling] Erro ao sincronizar ${product.name}:`, error);
        }
      } catch (err) {
        erros++;
        console.error(`[Bling] Exceção ao sincronizar ${product.name}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      sincronizados,
      erros,
      total: products.length,
      message: `${sincronizados}/${products.length} produtos sincronizados${erros > 0 ? `, ${erros} erros` : ""}`,
    });
  } catch (error) {
    console.error("[Bling] Erro na sincronização:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
