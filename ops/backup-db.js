const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

if (!process.env.DB_PATH || !process.env.BACKUP_FILE) {
  throw new Error("DB_PATH and BACKUP_FILE are required");
}
if (!fs.existsSync(process.env.DB_PATH)) {
  throw new Error("source database does not exist");
}
if (fs.existsSync(process.env.BACKUP_FILE)) {
  throw new Error("backup target already exists");
}

const db = new DatabaseSync(process.env.DB_PATH);
try {
  const sourceCheck = db.prepare("PRAGMA quick_check").all();
  if (!sourceCheck.every((row) => Object.values(row).includes("ok"))) {
    throw new Error("source database integrity check failed");
  }
  const target = process.env.BACKUP_FILE.replaceAll("'", "''");
  db.exec(`VACUUM INTO '${target}'`);
} finally {
  db.close();
}

const backup = new DatabaseSync(process.env.BACKUP_FILE, { readOnly: true });
try {
  const backupCheck = backup.prepare("PRAGMA quick_check").all();
  if (!backupCheck.every((row) => Object.values(row).includes("ok"))) {
    throw new Error("backup database integrity check failed");
  }
} finally {
  backup.close();
}
