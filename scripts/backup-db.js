import fs from 'fs';
import path from 'path';

const src = process.env.DB_PATH || path.join(process.cwd(), 'data', 'keiba.sqlite');
const backupDir = path.join(process.cwd(), 'backup');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dest = path.join(backupDir, `keiba-${stamp}.sqlite`);

if (!fs.existsSync(src)) {
  console.error(`DB not found: ${src}`);
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log(`Backup created: ${dest}`);
