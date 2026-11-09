import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const COOKIE = "customer_token";
const EXPIRES_DAYS = 30;

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET/NEXTAUTH_SECRET não configurado");
  return s;
}

const SECURE = (process.env.NEXTAUTH_URL ?? "").startsWith("https://") ? "; Secure" : "";

export interface CustomerPayload {
  id: string;
  email: string;
  name: string;
}

export function signToken(payload: CustomerPayload): string {
  const exp = Math.floor(Date.now() / 1000) + EXPIRES_DAYS * 24 * 60 * 60;
  const data = Buffer.from(JSON.stringify({ id: payload.id, email: payload.email, name: payload.name, exp })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): CustomerPayload | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expected = Buffer.from(createHmac("sha256", secret()).update(data).digest("base64url"));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString()) as CustomerPayload & { exp?: number };
    // Tokens without expiry (issued before this change) are no longer accepted
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now() / 1000) return null;
    return { id: parsed.id, email: parsed.email, name: parsed.name };
  } catch {
    return null;
  }
}

export async function getCustomerFromCookie(): Promise<CustomerPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function buildCookieHeader(token: string): string {
  const maxAge = EXPIRES_DAYS * 24 * 60 * 60;
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE}`;
}

export function clearCookieHeader(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${SECURE}`;
}

export function getCustomerFromRequest(req: NextRequest): CustomerPayload | null {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
