import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const settings = await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });

    if (!settings?.blingClientId) {
      return NextResponse.json({ error: "Bling Client ID not configured" }, { status: 400 });
    }

    const redirectUri = `${new URL(req.url).origin}/api/settings/bling/callback`;
    const state = Math.random().toString(36).substring(7);

    const authorizationUrl = new URL("https://bling.com.br/Api/v3/oauth/authorize");
    authorizationUrl.searchParams.append("response_type", "code");
    authorizationUrl.searchParams.append("client_id", settings.blingClientId);
    authorizationUrl.searchParams.append("redirect_uri", redirectUri);
    authorizationUrl.searchParams.append("state", state);

    console.log("[Bling Auth] Redirecting to:", authorizationUrl.toString());

    return NextResponse.redirect(authorizationUrl.toString());
  } catch (error) {
    console.error("[Bling Auth] Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
