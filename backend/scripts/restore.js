import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let dbPath = path.join(rootDir, 'prisma', 'dev.db');
if (!fs.existsSync(path.dirname(dbPath))) {
  dbPath = path.join(rootDir, 'dev.db');
}
const backupsDir = path.join(rootDir, 'backups');

if (!fs.existsSync(backupsDir)) {
  console.error(`❌ Backups directory not found at: ${backupsDir}`);
  process.exit(1);
}

const backupFileArg = process.argv[2];

let targetBackupFile = backupFileArg;

if (!targetBackupFile) {
  // Pick the latest .db backup file
  const files = fs.readdirSync(backupsDir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({
      name: f,
      time: fs.statSync(path.join(backupsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    console.error(`❌ No .db backup files found in: ${backupsDir}`);
    process.exit(1);
  }

  targetBackupFile = files[0].name;
}

const sourceBackupPath = path.isAbsolute(targetBackupFile)
  ? targetBackupFile
  : path.join(backupsDir, targetBackupFile);

if (!fs.existsSync(sourceBackupPath)) {
  console.error(`❌ Specified backup file does not exist: ${sourceBackupPath}`);
  process.exit(1);
}

try {
  // Create safety copy of current db
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, path.join(backupsDir, `pre-restore-${Date.now()}.db`));
  }

  fs.copyFileSync(sourceBackupPath, dbPath);
  console.log(`✅ Database successfully restored from: ${sourceBackupPath}`);
} catch (err) {
  console.error(`❌ Restore failed:`, err);
  process.exit(1);
}
