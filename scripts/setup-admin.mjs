import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const EMAIL = process.env.ADMIN_EMAIL || "admin@loja.com";
const PASS = process.env.ADMIN_PASS || "admin123";

const hash = await bcrypt.hash(PASS, 10);

await prisma.adminUser.upsert({
  where: { email: EMAIL },
  update: { password: hash },
  create: { email: EMAIL, password: hash, name: "Administrador" },
});

const existing = await prisma.companySettings.findFirst();
if (!existing) {
  await prisma.companySettings.create({
    data: {
      name: "Minha Loja de Roupas",
      description: "As melhores roupas com estilo e qualidade",
      primaryColor: "#ec4899",
      bannerImages: "[]",
    },
  });
}

console.log(`✓ Admin pronto: ${EMAIL} / ${PASS}`);
await prisma.$disconnect();
