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

// Deduplicate CompanySettings: keep the row with most custom data
const DEFAULT_NAMES = ["Minha Loja de Roupas", "Minha Loja", ""];
const allSettings = await prisma.companySettings.findMany();
if (allSettings.length > 1) {
  allSettings.sort((a, b) => {
    const scoreA = (!DEFAULT_NAMES.includes(a.name) ? 2 : 0) + (a.bannerImages !== "[]" ? 1 : 0);
    const scoreB = (!DEFAULT_NAMES.includes(b.name) ? 2 : 0) + (b.bannerImages !== "[]" ? 1 : 0);
    return scoreB - scoreA;
  });
  const [keep, ...toDelete] = allSettings;
  await prisma.companySettings.deleteMany({ where: { id: { in: toDelete.map((s) => s.id) } } });
  console.log(`✓ CompanySettings deduplicado: manteve "${keep.name}", removeu ${toDelete.length} duplicata(s)`);
}

console.log(`✓ Admin pronto: ${EMAIL} / ${PASS}`);
await prisma.$disconnect();
