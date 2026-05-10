/**
 * Cria usuário admin no banco PostgreSQL (Neon).
 * Uso: DATABASE_URL="postgresql://..." node scripts/create-admin-prod.mjs
 *
 * Ou defina o DATABASE_URL no .env.local e rode:
 *   node --env-file=.env.local scripts/create-admin-prod.mjs
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/index.js";

const EMAIL = process.env.ADMIN_EMAIL || "admin@loja.com";
const SENHA = process.env.ADMIN_PASS || "admin123";
const NOME  = process.env.ADMIN_NAME || "Administrador";

const prisma = new PrismaClient();

const hash = await bcrypt.hash(SENHA, 10);

try {
  const existing = await prisma.adminUser.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`Admin já existe: ${EMAIL}`);
  } else {
    await prisma.adminUser.create({ data: { email: EMAIL, password: hash, name: NOME } });
    console.log(`✓ Admin criado: ${EMAIL} / ${SENHA}`);
    console.log("  Troque a senha após o primeiro login!");
  }
} finally {
  await prisma.$disconnect();
}
