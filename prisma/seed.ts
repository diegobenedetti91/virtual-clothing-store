import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existingUser = await prisma.adminUser.findFirst();
  if (!existingUser) {
    const hashed = await bcrypt.hash("admin123", 10);
    await prisma.adminUser.create({
      data: {
        email: "admin@loja.com",
        password: hashed,
        name: "Administradora",
      },
    });
    console.log("✅ Admin criado: admin@loja.com / admin123");
  } else {
    console.log("ℹ️  Admin já existe");
  }

  const existingSettings = await prisma.companySettings.findFirst();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
