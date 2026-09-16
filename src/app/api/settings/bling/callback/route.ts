import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  console.log("[Bling Callback] Recebido:", { code, state, error });

  if (error) {
    return NextResponse.json({ error: `Bling authorization failed: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "No authorization code received" }, { status: 400 });
  }

  // Pegar settings para obter client_id e client_secret
  const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });

  if (!settings?.blingClientId || !settings?.blingClientSecret) {
    return NextResponse.json({ error: "Bling credentials not configured" }, { status: 400 });
  }

  // Trocar code por token
  try {
    console.log("[Bling Callback] Trocando code por token...");
    const tokenResponse = await fetch("https://bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: settings.blingClientId,
        client_secret: settings.blingClientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("[Bling Callback] Erro ao trocar code por token:", error);
      return NextResponse.json({ error: `Failed to exchange code for token: ${error}` }, { status: 400 });
    }

    const tokenData = await tokenResponse.json();
    console.log("[Bling Callback] Token obtido com sucesso");

    // Salvar token no banco
    const expiresAt = new Date(Date.now() + (tokenData.expires_in - 60) * 1000);
    await prisma.companySettings.update({
      where: { id: settings.id },
      data: {
        blingAccessToken: tokenData.access_token,
        blingTokenExpiresAt: expiresAt,
      },
    });

    console.log("[Bling Callback] Token salvo no banco");

    // Redirecionar de volta para as configurações
    return NextResponse.redirect(new URL("/admin/menu?bling=success", req.url));
  } catch (error) {
    console.error("[Bling Callback] Exceção:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
