import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const settings = await prisma.companySettings.findFirst();

    if (!settings?.blingClientId) {
      return NextResponse.json(
        { error: "Client ID não configurado" },
        { status: 400 }
      );
    }

    const redirectUri = `${req.nextUrl.origin}/api/settings/bling/callback`;
    const state = Buffer.from(Math.random().toString()).toString("base64");

    const authUrl = new URL("https://api.bling.com.br/Api/v3/oauth/authorize");
    authUrl.searchParams.append("client_id", settings.blingClientId);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("response_type", "code");

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("[Bling] Authorize error:", error);
    return NextResponse.json(
      { error: "Erro ao gerar URL de autorização" },
      { status: 500 }
    );
  }
}
