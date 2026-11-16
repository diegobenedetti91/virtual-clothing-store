/**
 * Link "esqueci minha senha" do cliente — sem tabela no banco.
 *
 * token = base64url("<id>.<expira>") + "." + HMAC(segredo, id, expira, hash da senha ATUAL)
 *  - expira em 1 hora;
 *  - como a assinatura inclui o hash da senha atual, o link deixa de valer assim que a senha é
 *    trocada (não pode ser reutilizado) e links antigos morrem junto.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

const VALID_MS = 60 * 60 * 1000;

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET/NEXTAUTH_SECRET não configurado");
  return s;
}

const sign = (id: string, exp: number, passwordHash: string) =>
  createHmac("sha256", secret()).update(`reset:${id}.${exp}.${passwordHash}`).digest("base64url");

export function createResetToken(customer: { id: string; password: string }): string {
  const exp = Date.now() + VALID_MS;
  const head = Buffer.from(`${customer.id}.${exp}`).toString("base64url");
  return `${head}.${sign(customer.id, exp, customer.password)}`;
}

/** Cliente dono do link, ou null (inválido, expirado ou senha já trocada). */
export async function verifyResetToken(token: unknown) {
  if (typeof token !== "string" || token.length > 500) return null;
  const [head, sig] = token.split(".");
  if (!head || !sig) return null;
  const [id, expRaw] = Buffer.from(head, "base64url").toString().split(".");
  const exp = Number(expRaw);
  if (!id || !Number.isFinite(exp) || Date.now() > exp) return null;
  const customer = await prisma.customerUser.findUnique({ where: { id }, select: { id: true, email: true, name: true, password: true } });
  if (!customer) return null;
  const expected = Buffer.from(sign(customer.id, exp, customer.password));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? customer : null;
}
