const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const [databasePath, restoreRoot] = process.argv.slice(2);
if (!databasePath || !fs.existsSync(databasePath)) {
  throw new Error("database backup path is required");
}

const database = new DatabaseSync(databasePath, { readOnly: true });
try {
  const integrity = database.prepare("PRAGMA quick_check").all();
  if (!integrity.every((row) => Object.values(row).includes("ok"))) {
    throw new Error("database integrity check failed");
  }

  const tables = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name));
  for (const table of ["booking_requests", "booking_attachments", "notification_outbox"]) {
    if (!tables.has(table)) throw new Error(`required table is missing: ${table}`);
  }

  const requestCount = Number(database.prepare("SELECT COUNT(*) AS count FROM booking_requests").get().count);
  const attachments = database.prepare("SELECT file_path FROM booking_attachments").all();
  if (restoreRoot) {
    const root = path.resolve(restoreRoot);
    for (const attachment of attachments) {
      const target = path.resolve(root, String(attachment.file_path || ""));
      if (!target.startsWith(`${root}${path.sep}`) || !fs.existsSync(target)) {
        throw new Error("restored attachment set is incomplete");
      }
    }
  }

  process.stdout.write(`${JSON.stringify({ ok: true, requests: requestCount, attachments: attachments.length })}\n`);
} finally {
  database.close();
}
