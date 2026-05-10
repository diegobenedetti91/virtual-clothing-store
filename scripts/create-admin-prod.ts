import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma";

const EMAIL = process.env.ADMIN_EMAIL || "admin@loja.com";
const SENHA = process.env.ADMIN_PASS  || "admin123";
const NOME  = process.env.ADMIN_NAME  || "Administrador";

async function main() {
  const prisma = new PrismaClient();
  const hash = await bcrypt.hash(SENHA, 10);
  try {
    const existing = await prisma.adminUser.findUnique({ where: { email: EMAIL } });
    if (existing) {
      console.log(`Admin já existe: ${EMAIL}`);
    } else {
      await prisma.adminUser.create({ data: { email: EMAIL, password: hash, name: NOME } });
      console.log(`✓ Admin criado: ${EMAIL} / ${SENHA}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
