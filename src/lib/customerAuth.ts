import { createHmac } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "customer-secret-key";
const COOKIE = "customer_token";
const EXPIRES_DAYS = 30;

export interface CustomerPayload {
  id: string;
  email: string;
  name: string;
}

export function signToken(payload: CustomerPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): CustomerPayload | null {
  try {
    const [data, sig] = token.split(".");
    const expected = createHmac("sha256", SECRET).update(data).digest("base64url");
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(data, "base64url").toString()) as CustomerPayload;
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
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookieHeader(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getCustomerFromRequest(req: NextRequest): CustomerPayload | null {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
