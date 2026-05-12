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
INSERT OR IGNORE INTO CompanySettings (id, name, description, primaryColor, bannerImages, updatedAt,address,checkoutType,checkoutCollectEmail,checkoutCollectAddress)
VALUES ('cmp2o5a0k00013xwwiqnaxvpw', 'Asthe Brand', '𝘊𝘰𝘯𝘤𝘦𝘪𝘵𝘰 𝘮𝘰𝘥𝘦𝘳𝘯𝘰 • 𝘢𝘵𝘦𝘮𝘱𝘰𝘳𝘢𝘭 • 𝘦𝘭𝘦𝘨𝘢𝘯𝘵𝘦', '#ec4899', '["/uploads/1778595323859-7ju2sd.jpeg","/uploads/1778595329228-h5aeby.jpeg"]', '${now}','Rua Frederico Tetzner Sobrinho 166, Limeira, Brazil 13480570','whatsapp',1,1);
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
