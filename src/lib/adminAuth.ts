import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Guard for admin-only API handlers (NextAuth only has admin accounts).
 * Usage: `const denied = await requireAdmin(); if (denied) return denied;`
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  return session?.user ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
