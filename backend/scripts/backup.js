import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let dbPath = path.join(rootDir, 'prisma', 'dev.db');
if (!fs.existsSync(dbPath)) {
  dbPath = path.join(rootDir, 'dev.db');
}
const backupsDir = path.join(rootDir, 'backups');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database file not found at: ${dbPath}`);
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFileName = `manual-backup-${timestamp}.db`;
const targetPath = path.join(backupsDir, backupFileName);

try {
  fs.copyFileSync(dbPath, targetPath);
  const stats = fs.statSync(targetPath);
  console.log(`✅ Database successfully backed up!`);
  console.log(`📁 File: ${targetPath}`);
  console.log(`📦 Size: ${(stats.size / 1024).toFixed(2)} KB`);
} catch (err) {
  console.error(`❌ Backup failed:`, err);
  process.exit(1);
}
