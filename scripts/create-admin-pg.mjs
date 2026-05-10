import pg from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const EMAIL = process.env.ADMIN_EMAIL || "admin@loja.com";
const SENHA = process.env.ADMIN_PASS  || "admin123";
const NOME  = process.env.ADMIN_NAME  || "Administrador";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const hash = await bcrypt.hash(SENHA, 10);

const res = await client.query(
  `INSERT INTO "AdminUser" (id, email, password, name, "createdAt")
   VALUES ($1, $2, $3, $4, NOW())
   ON CONFLICT (email) DO NOTHING
   RETURNING email`,
  [randomUUID(), EMAIL, hash, NOME]
);

if (res.rowCount > 0) {
  console.log(`✓ Admin criado: ${EMAIL} / ${SENHA}`);
} else {
  console.log(`Admin já existe: ${EMAIL}`);
}

await client.end();
