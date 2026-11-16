// Roda em todo build (npm run build). Garante o usuário admin e a linha de configurações da loja.
//
// Senha do admin — nunca existe senha padrão:
//  - ADMIN_PASS definido (8+ caracteres): define/atualiza a senha (é assim que se troca a senha do admin).
//  - ADMIN_PASS vazio e o admin já existe: a senha atual não é tocada.
//  - ADMIN_PASS vazio e loja nova: gera uma senha aleatória e mostra UMA vez no log do build.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();
const EMAIL = (process.env.ADMIN_EMAIL || "admin@loja.com").trim().toLowerCase();
const NAME = process.env.ADMIN_NAME || "Administrador";
const PASS = process.env.ADMIN_PASS || "";
const WEAK = new Set(["admin123", "12345678", "123456789", "password", "senha123"]);

const existing = await prisma.adminUser.findUnique({ where: { email: EMAIL } });

if (PASS && (PASS.length < 8 || WEAK.has(PASS.toLowerCase()))) {
  console.warn(`⚠ ADMIN_PASS fraca (mínimo 8 caracteres, nada de "admin123"): senha do admin NÃO alterada.`);
  if (!existing) {
    const generated = randomBytes(9).toString("base64url");
    await prisma.adminUser.create({ data: { email: EMAIL, password: await bcrypt.hash(generated, 10), name: NAME } });
    console.log(`✓ Admin criado: ${EMAIL} / ${generated}  ← anote agora (aparece só uma vez)`);
  }
} else if (PASS) {
  const hash = await bcrypt.hash(PASS, 10);
  await prisma.adminUser.upsert({ where: { email: EMAIL }, update: { password: hash }, create: { email: EMAIL, password: hash, name: NAME } });
  console.log(`✓ Admin pronto: ${EMAIL} (senha definida pelo ADMIN_PASS)`);
} else if (!existing) {
  const generated = randomBytes(9).toString("base64url");
  await prisma.adminUser.create({ data: { email: EMAIL, password: await bcrypt.hash(generated, 10), name: NAME } });
  console.log(`✓ Admin criado: ${EMAIL} / ${generated}  ← anote agora (aparece só uma vez)`);
} else {
  console.log(`✓ Admin existente: ${EMAIL} (senha mantida)`);
}

const settings = await prisma.companySettings.findFirst();
if (!settings) {
  await prisma.companySettings.create({
    data: {
      name: "Minha Loja de Roupas",
      description: "As melhores roupas com estilo e qualidade",
      primaryColor: "#ec4899",
      bannerImages: "[]",
    },
  });
}

await prisma.$disconnect();
