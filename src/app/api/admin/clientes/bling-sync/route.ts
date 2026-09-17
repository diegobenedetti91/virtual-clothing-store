import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function obterTokenBling(settings: any): Promise<string | null> {
  if (!settings.blingAccessToken) {
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

    const customers = await prisma.customerUser.findMany();

    let sincronizados = 0;
    let erros = 0;
    const delayMs = 400; // 400ms = ~2.5 req/s (respeitando limite de 3 req/s do Bling)

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];

      // Adiciona delay entre requisições (exceto na primeira)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      try {
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
          sincronizados++;
          const data = await response.json();
          const blingId = data.data?.id;

          if (blingId) {
            await prisma.customerUser.update({
              where: { id: customer.id },
              data: { blingContatoId: String(blingId) },
            });
          }

          console.log(`[Bling] Cliente sincronizado: ${customer.name}${blingId ? ` (ID: ${blingId})` : ""}`);
        } else {
          erros++;
          const error = await response.text();
          console.error(`[Bling] Erro ao sincronizar ${customer.name}:`, error);
        }
      } catch (err) {
        erros++;
        console.error(`[Bling] Exceção ao sincronizar ${customer.name}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      sincronizados,
      erros,
      total: customers.length,
      message: `${sincronizados}/${customers.length} clientes sincronizados${erros > 0 ? `, ${erros} erros` : ""}`,
    });
  } catch (error) {
    console.error("[Bling] Erro na sincronização de clientes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
