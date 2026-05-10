import pg from "pg";
import bcrypt from "bcryptjs";

const EMAIL = "admin@loja.com";
const NOVA_SENHA = process.env.ADMIN_PASS || "admin123";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const hash = await bcrypt.hash(NOVA_SENHA, 10);

const res = await client.query(
  `UPDATE "AdminUser" SET password = $1 WHERE email = $2 RETURNING email`,
  [hash, EMAIL]
);

if (res.rowCount > 0) {
  console.log(`✓ Senha resetada: ${EMAIL} / ${NOVA_SENHA}`);
} else {
  // cria se não existir
  const { randomUUID } = await import("crypto");
  await client.query(
    `INSERT INTO "AdminUser" (id, email, password, name, "createdAt") VALUES ($1, $2, $3, $4, NOW())`,
    [randomUUID(), EMAIL, hash, "Administrador"]
  );
  console.log(`✓ Admin criado: ${EMAIL} / ${NOVA_SENHA}`);
}

await client.end();
