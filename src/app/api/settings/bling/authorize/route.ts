import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const settings = await prisma.companySettings.findFirst();

    if (!settings?.blingClientId) {
      return NextResponse.json(
        { error: "Client ID não configurado" },
        { status: 400 }
      );
    }

    const redirectUri = `${req.nextUrl.origin}/api/settings/bling/callback`;
    const state = randomBytes(24).toString("base64url");

    const authUrl = new URL("https://api.bling.com.br/Api/v3/oauth/authorize");
    authUrl.searchParams.append("client_id", settings.blingClientId);
    authUrl.searchParams.append("redirect_uri", redirectUri);
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("response_type", "code");

    const res = NextResponse.redirect(authUrl.toString());
    // Checked by the callback, so a forged callback can't swap the store's Bling tokens
    res.cookies.set("bling_oauth_state", state, {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/api/settings/bling",
      maxAge: 600,
    });
    return res;
  } catch (error) {
    console.error("[Bling] Authorize error:", error);
    return NextResponse.json(
      { error: "Erro ao gerar URL de autorização" },
      { status: 500 }
    );
  }
}
