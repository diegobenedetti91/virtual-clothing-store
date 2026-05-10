import bcrypt from "bcryptjs";

const DB_PATH = "/home/diegobenedetti/repositories/VirtualClothingStore/prisma/dev.db";

const hash = await bcrypt.hash("admin123", 10);

const { default: Database } = await import("better-sqlite3").catch(() => null) ?? {};

if (!Database) {
  // fallback: print the hash so user can insert manually
  console.log("Hash gerado:", hash);
  console.log("Use: npx prisma studio para inserir manualmente.");
  process.exit(0);
}

const db = new Database(DB_PATH);
const id = "clz" + Math.random().toString(36).slice(2, 20);
db.prepare(`
  INSERT OR IGNORE INTO AdminUser (id, email, password, name, createdAt)
  VALUES (?, 'admin@loja.com', ?, 'Administrador', datetime('now'))
`).run(id, hash);
db.close();
console.log("Admin criado: admin@loja.com / admin123");
