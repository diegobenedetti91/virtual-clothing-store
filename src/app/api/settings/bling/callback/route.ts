import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.redirect(
        `${req.nextUrl.origin}/admin/menu?bling=error&reason=missing_params`
      );
    }

    const settings = await prisma.companySettings.findFirst();
    if (!settings?.blingClientId || !settings?.blingClientSecret) {
      return NextResponse.redirect(
        `${req.nextUrl.origin}/admin/menu?bling=error&reason=no_credentials`
      );
    }

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
        grant_type: "authorization_code",
        code,
        redirect_uri: `${req.nextUrl.origin}/api/settings/bling/callback`,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Bling] Token exchange failed:", error);
      return NextResponse.redirect(
        `${req.nextUrl.origin}/admin/menu?bling=error&reason=token_exchange`
      );
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

    console.log("[Bling] Tokens saved successfully");
    return NextResponse.redirect(
      `${req.nextUrl.origin}/admin/menu?bling=success`
    );
  } catch (error) {
    console.error("[Bling] Callback error:", error);
    return NextResponse.redirect(
      new URL("/admin/menu?bling=error", req.nextUrl.origin),
      { status: 302 }
    );
  }
}
