// Seed via Prisma Studio or API
// This seed is executed via the API route on first run
// Run: node prisma/seed.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');

const hash = bcrypt.hashSync('admin123', 10);
const now = new Date().toISOString();

// Use prisma CLI
import { execSync } from 'child_process';
const sql = `
INSERT OR IGNORE INTO AdminUser (id, email, password, name, createdAt)
VALUES ('seed_admin_001', 'admin@loja.com', '${hash}', 'Administradora', '${now}');
INSERT OR IGNORE INTO CompanySettings (id, name, description, primaryColor, bannerImages, updatedAt)
VALUES ('seed_settings_001', 'Minha Loja de Roupas', 'As melhores roupas com estilo e qualidade', '#ec4899', '[]', '2021-05-11 14:15:31.165');
`;

// Write SQL to file and execute via prisma db execute
import { writeFileSync, unlinkSync } from 'fs';
writeFileSync('/tmp/seed.sql', sql);
try {
  execSync('npx prisma db execute --file /tmp/seed.sql --schema prisma/schema.prisma', { stdio: 'inherit' });
  console.log('✅ Seed concluído: admin@loja.com / admin123');
} finally {
  unlinkSync('/tmp/seed.sql');
}
