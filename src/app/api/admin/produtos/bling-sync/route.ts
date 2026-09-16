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

    for (const product of products) {
      try {
        const imagens = JSON.parse(product.images || "[]") as string[];

        const pesoGramas = product.pesoGramas || 0;
        const pesoKg = pesoGramas / 1000;

        const blingProduct = {
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

        const response = await fetch("https://api.bling.com.br/Api/v3/produtos", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(blingProduct),
        });

        if (response.ok) {
          sincronizados++;
          console.log(`[Bling] Produto sincronizado: ${product.name}`);
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
