import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  const isLoginPage = req.nextUrl.pathname === "/admin/login";
  const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");

  if (!isAdminRoute) return NextResponse.next();

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const secureCookies = req.nextUrl.protocol === "https:";
  const cookieName = secureCookies
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = await getToken({ req, secret, cookieName });

  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  if (token && isLoginPage) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
