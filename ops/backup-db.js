const { DatabaseSync } = require("node:sqlite");

if (!process.env.DB_PATH || !process.env.BACKUP_FILE) {
  throw new Error("DB_PATH and BACKUP_FILE are required");
}

const db = new DatabaseSync(process.env.DB_PATH);
try {
  const target = process.env.BACKUP_FILE.replaceAll("'", "''");
  db.exec(`VACUUM INTO '${target}'`);
} finally {
  db.close();
}
