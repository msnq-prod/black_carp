const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const { DatabaseSync } = require("node:sqlite");

const rootDir = __dirname;
loadEnvFile(path.join(rootDir, ".env"));
const buildRevision = readBuildRevision();

const dataDir = path.join(rootDir, "data");
const uploadsDir = path.join(rootDir, "uploads", "booking");
const dbPath = process.env.DB_PATH || path.join(dataDir, "black-carp.sqlite");
const port = Number(process.env.PORT || 3001);
const botUsername = (process.env.BOT_USERNAME || "blackcarp_bot").replace(/^@/, "");
const host = process.env.HOST || (fs.existsSync("/.dockerenv") ? "0.0.0.0" : "127.0.0.1");
const trustProxy = configuredTrustProxy();
const LATEST_SCHEMA_VERSION = 2;
const bookingJson = express.json({ limit: process.env.JSON_LIMIT || "25mb" });
const crmJson = express.json({ limit: "32kb" });
const webhookJson = express.json({ limit: "1mb" });
const CRM_STATUSES = ["new", "in_review", "need_details", "approved", "scheduled", "done", "cancelled"];
const CRM_TRANSITIONS = {
  new: ["in_review", "need_details", "approved", "scheduled", "cancelled"],
  in_review: ["need_details", "approved", "scheduled", "cancelled"],
  need_details: ["in_review", "approved", "cancelled"],
  approved: ["scheduled", "cancelled"],
  scheduled: ["done", "cancelled"],
  done: [],
  cancelled: []
};
const bookingRateBuckets = new Map();

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const databaseExisted = fs.existsSync(dbPath);
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
hardenRuntimePermissions();
assertSupportedDatabaseVersion(db);
backupDatabaseBeforeMigration(db, databaseExisted);
db.exec(schemaSql());
runMigrations(db);
recoverStaleOutboxClaims(db);

const app = express();
app.set("trust proxy", trustProxy);

app.use(securityHeaders);
app.use(cors);
app.use("/api/crm", (req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });

app.get("/health", (req, res) => {
  try {
    db.prepare("SELECT 1 AS ok").get();
    const missing = requiredConfiguration();
    const ready = missing.length === 0;
    res.status(ready ? 200 : 503).json({ ok: ready, service: "black-carp", release: releaseSha(), database: "ready", configuration: ready ? "ready" : "incomplete", missing });
  } catch {
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.post("/api/ops/readiness", requireDeployProbeToken, async (req, res) => {
  let databaseReady = false;
  try {
    db.prepare("SELECT 1 AS ok").get();
    databaseReady = true;
    await telegramRequest("getMe", {});
    await telegramRequest("setWebhook", {
      url:`${siteUrl()}/telegram/webhook`,
      secret_token:process.env.WEBHOOK_SECRET,
      allowed_updates:["message", "callback_query"],
      drop_pending_updates:false
    });
    const webhook = await telegramRequest("getWebhookInfo", {});
    if (String(webhook?.result?.url || "") !== `${siteUrl()}/telegram/webhook`) throw new Error("telegram_webhook_mismatch");
    await Promise.all(masterIds().map((chatId) => telegramRequest("sendChatAction", { chat_id:chatId, action:"typing" })));
    res.json({ ok:true, release:releaseSha(), database:"ready", telegram:"ready", webhook:"ready" });
  } catch (error) {
    console.error("deploy_readiness_failed", error);
    res.status(503).json({ ok:false, release:releaseSha(), database:databaseReady ? "ready" : "unavailable", telegram:"unavailable", webhook:"unavailable" });
  }
});

app.post("/api/booking/submit", bookingRateLimit, bookingJson, async (req, res) => {
  try {
    const payload = req.body;
    const validationError = validateBookingPayload(payload);
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const existing = payload.idempotencyKey
      ? db.prepare("SELECT id, public_code, status, master_notified_at FROM booking_requests WHERE idempotency_key = ?").get(payload.idempotencyKey)
      : null;

    if (existing) {
      return res.json({
        ok: true,
        requestId: existing.id,
        publicCode: existing.public_code,
        telegramUrl: telegramStartUrl(existing.public_code),
        status: existing.status,
        masterNotified: Boolean(existing.master_notified_at),
        duplicate: true
      });
    }

    const requestId = `req_${crypto.randomUUID()}`;
    const publicCode = createPublicCode();
    const now = new Date().toISOString();
    const priceEstimate = estimatePrice(payload);
    let attachments = [];
    try {
      attachments = saveAttachments(requestId, payload.attachments || []);
    } catch (error) {
      cleanupRequestFiles(requestId);
      throw error;
    }

    try {
      db.exec("BEGIN IMMEDIATE");
      db.prepare(`
      INSERT INTO booking_requests (
        id, public_code, idempotency_key, status, source,
        first_tattoo, been_to_master, has_sketch, sketch_comment,
        body_zone, body_subzone, body_view, size_preset, size_cm,
        idea_text, price_estimate, consent_at, submitted_at,
        client_name, contact_type, contact_value, contact_comment,
        crm_updated_at, client_ip_hash, user_agent_hash, created_at, updated_at
      )
      VALUES (?, ?, ?, 'new', 'website', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestId,
      publicCode,
      payload.idempotencyKey || null,
      payload.firstTattoo,
      payload.beenToMaster || null,
      payload.hasSketch ? 1 : 0,
      normalizeText(payload.sketchComment),
      normalizeShortText(payload.bodyZone, 80),
      normalizeShortText(payload.bodySubzone, 80),
      payload.bodyView || "front",
      payload.sizePreset || null,
      payload.sizeCm ? Number(payload.sizeCm) : null,
      normalizeText(payload.ideaText),
      priceEstimate,
      payload.consentAt || now,
      now,
      normalizeContactName(payload.clientName),
      payload.contactType,
      normalizeContactValue(payload.contactValue, payload.contactType),
      normalizeShortText(payload.contactComment, 500),
      now,
      sha256(req.ip || ""),
      sha256(req.get("user-agent") || ""),
      now,
      now
    );

      const insertAttachment = db.prepare(`
      INSERT INTO booking_attachments (id, request_id, kind, file_path, mime_type, size_bytes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
      for (const attachment of attachments) {
      insertAttachment.run(
        attachment.id,
        requestId,
        attachment.kind,
        attachment.filePath,
        attachment.mimeType,
        attachment.sizeBytes,
        now
      );
      }

      appendStatus(requestId, null, "new", "system", null, "Анкета сохранена с сайта");
      appendCrmActivity(requestId, "system", null, "request_created", { publicCode });
      enqueueMasterNotification(requestId, now);
      db.exec("COMMIT");
    } catch (error) {
      try { db.exec("ROLLBACK"); } catch {}
      cleanupRequestFiles(requestId);
      throw error;
    }

    const notifyResult = await deliverPendingNotification(requestId);

    res.json({
      ok: true,
      requestId,
      publicCode,
      telegramUrl: telegramStartUrl(publicCode),
      status: "new",
      masterNotified: notifyResult.ok
    });
  } catch (error) {
    console.error("booking_submit_error", error);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

app.get("/api/crm/me", requireCrmAuth, (req, res) => {
  res.json({ ok: true, master: { telegramId: Number(req.master.telegramId), name: req.master.name } });
});

app.get("/api/crm/requests", requireCrmAuth, (req, res) => {
  const status = String(req.query.status || "").trim();
  const q = normalizeShortText(req.query.q, 120);
  const from = validDateFilter(req.query.from);
  const to = validDateFilter(req.query.to);
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 30, 100));
  const cursor = decodeCursor(req.query.cursor);
  if (status && !CRM_STATUSES.includes(status)) return res.status(400).json({ ok: false, error: "invalid_status" });
  if ((req.query.from && !from) || (req.query.to && !to) || (req.query.cursor && !cursor)) return res.status(400).json({ ok: false, error: "invalid_filter" });
  const conditions = [];
  const values = [];
  if (status) { conditions.push("r.status = ?"); values.push(status); }
  if (q) { conditions.push("(r.public_code LIKE ? OR r.client_name LIKE ? OR r.contact_value LIKE ?)"); values.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`, `%${escapeLike(q)}%`); }
  if (from) { conditions.push("r.created_at >= ?"); values.push(from); }
  if (to) { conditions.push("r.created_at <= ?"); values.push(to); }
  if (cursor) { conditions.push("(r.created_at < ? OR (r.created_at = ? AND r.id < ?))"); values.push(cursor.createdAt, cursor.createdAt, cursor.id); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`SELECT r.id, r.public_code, r.status, r.client_name, r.contact_value, r.body_zone, r.body_subzone, r.size_cm, r.has_sketch, r.created_at, EXISTS(SELECT 1 FROM booking_attachments a WHERE a.request_id=r.id) AS has_attachments FROM booking_requests r ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT ?`).all(...values, limit + 1);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(crmListItem);
  const last = items.at(-1);
  const counts = Object.fromEntries(db.prepare("SELECT status, COUNT(*) AS count FROM booking_requests GROUP BY status").all().map((row) => [row.status, Number(row.count)]));
  res.json({ ok: true, items, counts, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null });
});

app.get("/api/crm/requests/:id", requireCrmAuth, (req, res) => {
  const request = crmRequestById(req.params.id);
  if (!request) return res.status(404).json({ ok: false, error: "not_found" });
  appendCrmActivity(request.id, "master", req.master.telegramId, "request_opened", null);
  res.json({ ok: true, request: crmDetail(request) });
});

app.patch("/api/crm/requests/:id/status", requireCrmAuth, crmJson, (req, res) => {
  const nextStatus = String(req.body?.status || "");
  if (!CRM_STATUSES.includes(nextStatus)) return res.status(400).json({ ok: false, error: "invalid_status" });
  const request = crmRequestById(req.params.id);
  if (!request) return res.status(404).json({ ok: false, error: "not_found" });
  if (request.status === nextStatus) return res.json({ ok: true, request: crmDetail(request), unchanged: true });
  if (!canTransition(request.status, nextStatus)) return res.status(409).json({ ok: false, error: "invalid_transition", currentStatus: request.status });
  const now = new Date().toISOString();
  withTransaction(() => {
    db.prepare("UPDATE booking_requests SET status=?, crm_updated_at=?, updated_at=? WHERE id=?").run(nextStatus, now, now, request.id);
    appendStatus(request.id, request.status, nextStatus, "master", req.master.telegramId, "Статус изменен в CRM");
    appendCrmActivity(request.id, "master", req.master.telegramId, "status_changed", { from: request.status, to: nextStatus });
  });
  res.json({ ok: true, request: crmDetail(crmRequestById(request.id)) });
});

app.post("/api/crm/requests/:id/notes", requireCrmAuth, crmJson, (req, res) => {
  const text = normalizeShortText(req.body?.text, 2000);
  if (!text || text.length < 1) return res.status(400).json({ ok: false, error: "note_required" });
  const request = crmRequestById(req.params.id);
  if (!request) return res.status(404).json({ ok: false, error: "not_found" });
  const note = { id: `note_${crypto.randomUUID()}`, requestId: request.id, masterTelegramId: req.master.telegramId, text, createdAt: new Date().toISOString() };
  withTransaction(() => {
    db.prepare("INSERT INTO crm_notes (id, request_id, master_telegram_id, text, created_at) VALUES (?, ?, ?, ?, ?)").run(note.id, note.requestId, note.masterTelegramId, note.text, note.createdAt);
    appendCrmActivity(request.id, "master", req.master.telegramId, "note_added", { noteId: note.id });
  });
  res.status(201).json({ ok: true, note });
});

app.patch("/api/crm/requests/:id/schedule", requireCrmAuth, crmJson, (req, res) => {
  const scheduledAt = String(req.body?.scheduledAt || "");
  const date = new Date(scheduledAt);
  const durationMinutes = Number(req.body?.durationMinutes);
  const comment = normalizeShortText(req.body?.comment, 500);
  if (Number.isNaN(date.getTime()) || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 1440) return res.status(400).json({ ok: false, error: "invalid_schedule" });
  const request = crmRequestById(req.params.id);
  if (!request) return res.status(404).json({ ok: false, error: "not_found" });
  if (request.status !== "scheduled" && !canTransition(request.status, "scheduled")) return res.status(409).json({ ok: false, error: "invalid_transition", currentStatus: request.status });
  const now = new Date().toISOString();
  const nextStatus = "scheduled";
  withTransaction(() => {
    db.prepare("UPDATE booking_requests SET scheduled_at=?, duration_minutes=?, schedule_comment=?, status='scheduled', crm_updated_at=?, updated_at=? WHERE id=?").run(date.toISOString(), durationMinutes, comment || null, now, now, request.id);
    if (nextStatus !== request.status) appendStatus(request.id, request.status, nextStatus, "master", req.master.telegramId, "Назначена дата в CRM");
    appendCrmActivity(request.id, "master", req.master.telegramId, "schedule_changed", { scheduledAt: date.toISOString(), durationMinutes, comment });
  });
  res.json({ ok: true, request: crmDetail(crmRequestById(request.id)) });
});

app.get("/api/crm/requests/:id/attachments/:attachmentId", requireCrmAuth, (req, res) => {
  const attachment = db.prepare("SELECT * FROM booking_attachments WHERE id=? AND request_id=?").get(req.params.attachmentId, req.params.id);
  if (!attachment) return res.status(404).json({ ok: false, error: "not_found" });
  const file = absoluteAttachmentPath(attachment.file_path);
  if (!file || !fs.existsSync(file)) return res.status(404).json({ ok: false, error: "file_not_found" });
  res.setHeader("Content-Type", attachment.mime_type);
  res.setHeader("Content-Disposition", `inline; filename="${path.basename(file).replace(/[^a-zA-Z0-9._-]/g, "_")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  fs.createReadStream(file).pipe(res);
});

app.post("/api/crm/outbox/:id/retry", requireCrmAuth, async (req, res) => {
  try {
    const outbox = db.prepare("SELECT id FROM notification_outbox WHERE id=?").get(req.params.id);
    if (!outbox) return res.status(404).json({ ok: false, error: "not_found" });
    const now = new Date().toISOString();
    const scheduled = db.prepare("UPDATE notification_outbox SET status='pending', next_attempt_at=?, claim_token=NULL, claimed_at=NULL, updated_at=? WHERE id=? AND status IN ('retry_wait','pending')")
      .run(now, now, outbox.id);
    if (scheduled.changes === 0) return res.status(409).json({ ok: false, error: "not_retryable" });
    const result = await deliverOutbox(outbox.id);
    if (result.error === "already_claimed" || result.error === "claim_lost") return res.status(409).json({ ok: false, error: result.error });
    res.status(result.ok ? 200 : 502).json({ ok: result.ok, outboxId: outbox.id, error: result.ok ? undefined : "delivery_failed" });
  } catch (error) {
    console.error("outbox_retry_error", error);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

app.post("/telegram/webhook", requireWebhookSecret, webhookJson, async (req, res) => {
  let telegramUpdateId = null;
  try {
    const update = req.body;
    if (!update || typeof update !== "object" || Array.isArray(update)) {
      return res.status(400).json({ ok: false, error: "invalid_update" });
    }
    if (typeof update.update_id === "number") {
      telegramUpdateId = update.update_id;
      const reserved = db.prepare("INSERT OR IGNORE INTO telegram_updates (id, update_id, event_type, received_at) VALUES (?, ?, 'received', ?)")
        .run(`upd_${crypto.randomUUID()}`, update.update_id, new Date().toISOString());
      if (reserved.changes === 0) {
        const existing = db.prepare("SELECT event_type, received_at FROM telegram_updates WHERE update_id=?").get(update.update_id);
        if (existing?.event_type === "received") {
          const leaseAge = Date.now() - new Date(existing.received_at).getTime();
          if (leaseAge < 5 * 60_000) return res.status(503).json({ ok: false, error: "update_processing" });
        } else if (existing?.event_type !== "failed") {
          return res.json({ ok: true, duplicate: true });
        }
        db.prepare("UPDATE telegram_updates SET event_type='received', request_id=NULL, received_at=? WHERE update_id=?").run(new Date().toISOString(), update.update_id);
      }
    }

    let requestId = null;
    let eventType = "unknown";
    if (update.message?.text?.startsWith("/start")) {
      eventType = "start";
      requestId = await handleStart(update.message);
    } else if (update.message?.text) {
      eventType = "client_message";
      requestId = await handleClientMessage(update.message);
    } else if (update.callback_query) {
      eventType = "callback";
      requestId = await handleCallback(update.callback_query);
    }

    if (typeof update.update_id === "number") db.prepare("UPDATE telegram_updates SET request_id=?, event_type=? WHERE update_id=?").run(requestId, eventType, update.update_id);

    res.json({ ok: true });
  } catch (error) {
    if (telegramUpdateId !== null) db.prepare("UPDATE telegram_updates SET event_type='failed' WHERE update_id=?").run(telegramUpdateId);
    console.error("telegram_webhook_error", error);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

app.get("/api/booking/status/:publicCode", (req, res) => {
  const row = db.prepare(`
    SELECT public_code, status, telegram_opened_at, submitted_at
    FROM booking_requests
    WHERE public_code = ?
  `).get(req.params.publicCode);

  if (!row) {
    return res.status(404).json({ ok: false, error: "not_found" });
  }

  res.json({
    ok: true,
    publicCode: row.public_code,
    status: row.status,
    submittedAt: row.submitted_at,
    telegramOpenedAt: row.telegram_opened_at,
    telegramUrl: telegramStartUrl(row.public_code)
  });
});

app.use("/assets", express.static(path.join(rootDir, "assets")));
app.use("/crm", express.static(path.join(rootDir, "crm"), { index: "index.html" }));

app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

for (const filename of ["styles.css", "script.js"]) {
  app.get(`/${filename}`, (req, res) => {
    res.sendFile(path.join(rootDir, filename));
  });
}

app.use((error, req, res, next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ ok: false, error: "payload_too_large" });
  if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, "body")) {
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }
  next(error);
});

if (require.main === module) {
  const server = app.listen(port, host, () => {
    console.log(`Black Carp server: http://${host}:${port}`);
    console.log(`API: http://${host}:${port}/api/booking/submit`);
  });
  setInterval(() => {
    deliverDueOutbox().catch((error) => console.error("outbox_worker_error", error));
  }, 60_000).unref();
  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

module.exports = { app, db, deliverDueOutbox };

async function handleStart(message) {
  const publicCode = message.text.split(/\s+/)[1]?.trim();
  if (!publicCode) {
    await sendTelegramMessage(message.chat.id, [
      "Здравствуйте.",
      "",
      "Чтобы создать запись, пожалуйста, сначала заполните анкету на сайте Black Carp."
    ].join("\n"), {
      inline_keyboard: [[{ text: "Перейти на сайт", url: `${siteUrl()}#/booking` }]]
    });
    return null;
  }

  const booking = db.prepare("SELECT * FROM booking_requests WHERE public_code = ?").get(publicCode);
  if (!booking) {
    await sendTelegramMessage(message.chat.id, "Заявка не найдена. Пожалуйста, заполните анкету заново.", {
      inline_keyboard: [[{ text: "Перейти к анкете", url: `${siteUrl()}#/booking` }]]
    });
    return null;
  }

  const now = new Date().toISOString();
  let linkConflict = false;
  withTransaction(() => {
    const current = db.prepare("SELECT client_id FROM booking_requests WHERE id=?").get(booking.id);
    if (current?.client_id) {
      const linkedClient = db.prepare("SELECT telegram_user_id FROM clients WHERE id=?").get(current.client_id);
      if (!linkedClient || String(linkedClient.telegram_user_id) !== String(message.from.id)) {
        linkConflict = true;
        return;
      }
    }
    const clientId = upsertClient(message.from, message.chat.id, now);
    db.prepare(`
      UPDATE booking_requests
      SET client_id = ?, telegram_opened_at = COALESCE(telegram_opened_at, ?), updated_at = ?
      WHERE id = ?
    `).run(clientId, now, now, booking.id);
    appendCrmActivity(booking.id, "client", String(message.from.id), "telegram_linked", null);
  });

  if (linkConflict) {
    await sendTelegramMessage(message.chat.id, "Эта заявка уже связана с другим Telegram-профилем. Свяжитесь с мастером по указанному ранее контакту.");
    return null;
  }

  await sendTelegramMessage(message.chat.id, [
    "Ваша заявка получена.",
    "",
    "Мастер скоро свяжется с вами для утверждения заявки.",
    "Если хотите, отправьте сюда дополнительные комментарии одним сообщением."
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "Открыть сайт", url: siteUrl() }],
      [{ text: "Заполнить заново", url: `${siteUrl()}#/booking` }]
    ]
  });

  return booking.id;
}

async function handleClientMessage(message) {
  const text = normalizeText(message.text);
  if (!text) return null;

  const client = db.prepare("SELECT id FROM clients WHERE telegram_user_id = ?").get(message.from?.id);
  if (!client) {
    await sendTelegramMessage(message.chat.id, [
      "Чтобы мастер увидел комментарий, сначала создайте заявку на сайте."
    ].join("\n"), {
      inline_keyboard: [[{ text: "Перейти на сайт", url: `${siteUrl()}#/booking` }]]
    });
    return null;
  }

  const booking = db.prepare(`
    SELECT id, public_code
    FROM booking_requests
    WHERE client_id = ?
    ORDER BY COALESCE(telegram_opened_at, created_at) DESC
    LIMIT 1
  `).get(client.id);

  if (!booking) {
    await sendTelegramMessage(message.chat.id, "Заявка не найдена. Пожалуйста, заполните анкету на сайте.", {
      inline_keyboard: [[{ text: "Перейти на сайт", url: `${siteUrl()}#/booking` }]]
    });
    return null;
  }

  const now = new Date().toISOString();
  let outboxIds = [];
  withTransaction(() => {
    const activityId = appendCrmActivity(booking.id, "client", String(message.from.id), "client_message", { text, delivered: false, delivery: "queued" });
    outboxIds = enqueueClientMessageNotification(booking.id, {
      activityId,
      clientLabel: formatTelegramUser(message.from),
      text
    }, now);
  });
  const sent = await deliverOutboxIds(outboxIds);
  await sendTelegramMessage(message.chat.id, sent.ok ? "Комментарий передан мастеру." : "Комментарий сохранён. Доставка будет повторена автоматически.");
  return booking.id;
}

async function handleCallback(callback) {
  const fromId = String(callback.from?.id || "");
  if (!masterTelegramIds().includes(fromId)) {
    await answerCallback(callback.id, "Нет доступа");
    return null;
  }

  const [requestId, action] = String(callback.data || "").split(":");
  const nextStatus = {
    review: "in_review",
    details: "need_details",
    offer: "approved",
    close: "cancelled"
  }[action];

  if (!requestId || !nextStatus) {
    await answerCallback(callback.id, "Неизвестное действие");
    return null;
  }

  const booking = db.prepare("SELECT status FROM booking_requests WHERE id = ?").get(requestId);
  if (!booking) {
    await answerCallback(callback.id, "Заявка не найдена");
    return null;
  }

  if (!canTransition(booking.status, nextStatus)) {
    await answerCallback(callback.id, "Переход недоступен");
    return requestId;
  }
  withTransaction(() => {
    db.prepare("UPDATE booking_requests SET status = ?, crm_updated_at=?, updated_at = ? WHERE id = ?")
      .run(nextStatus, new Date().toISOString(), new Date().toISOString(), requestId);
    appendStatus(requestId, booking.status, nextStatus, "master", fromId, "Статус изменен кнопкой мастера");
    appendCrmActivity(requestId, "master", fromId, "status_changed", { from: booking.status, to: nextStatus, source: "telegram_callback" });
  });
  await answerCallback(callback.id, `Статус: ${nextStatus}`);
  return requestId;
}

function saveAttachments(requestId, attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return [];

  const requestDir = path.join(uploadsDir, requestId);
  fs.mkdirSync(requestDir, { recursive: true });
  fs.chmodSync(requestDir, 0o700);

  return attachments.slice(0, 4).flatMap((attachment, index) => {
    const parsed = parseDataUrl(attachment.dataUrl);
    if (!parsed || parsed.buffer.length > maxAttachmentBytes()) return [];

    const kind = attachment.kind === "sketch" ? "sketch" : "reference";
    const filename = `${kind}-${index + 1}.${mimeExtension(parsed.mimeType)}`;
    const absolutePath = path.join(requestDir, filename);
    fs.writeFileSync(absolutePath, parsed.buffer);
    fs.chmodSync(absolutePath, 0o600);

    return [{
      id: `att_${crypto.randomUUID()}`,
      kind,
      filePath: path.relative(rootDir, absolutePath).replace(/\\/g, "/"),
      mimeType: parsed.mimeType,
      sizeBytes: parsed.buffer.length
    }];
  });
}

async function notifyMaster(payload, chatId) {
  if (!process.env.BOT_TOKEN || !chatId) {
    return { ok: false, error: "bot_not_configured" };
  }

  const replyMarkup = {
    inline_keyboard: [
      [{ text: "Открыть заявку", web_app: { url: `${crmWebAppUrl()}?request=${encodeURIComponent(payload.publicCode)}` } }]
    ]
  };

  return sendTelegramMessage(chatId, masterCardText(payload), replyMarkup);
}

async function sendTelegramMessage(chatId, text, replyMarkup) {
  if (!process.env.BOT_TOKEN) return { ok: false, error: "bot_not_configured" };

  try {
    const data = await telegramRequest("sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: replyMarkup || undefined,
      disable_web_page_preview: true
    });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function answerCallback(callbackQueryId, text) {
  if (!process.env.BOT_TOKEN || !callbackQueryId) return;
  try {
    await telegramRequest("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
  } catch (error) {
    console.error("telegram_callback_answer_error", String(error?.message || error));
  }
}

function upsertClient(user, chatId, now) {
  const existing = db.prepare("SELECT id FROM clients WHERE telegram_user_id = ?").get(user.id);
  if (existing) {
    db.prepare(`
      UPDATE clients
      SET telegram_chat_id = ?, telegram_username = ?, first_name = ?, last_name = ?, updated_at = ?
      WHERE id = ?
    `).run(chatId, user.username || null, user.first_name || null, user.last_name || null, now, existing.id);
    return existing.id;
  }

  const clientId = `cli_${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO clients (
      id, telegram_user_id, telegram_chat_id, telegram_username,
      first_name, last_name, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clientId,
    user.id,
    chatId,
    user.username || null,
    user.first_name || null,
    user.last_name || null,
    now,
    now
  );
  return clientId;
}

function appendStatus(requestId, fromStatus, toStatus, actorType, actorId, note) {
  db.prepare(`
    INSERT INTO status_history (id, request_id, from_status, to_status, actor_type, actor_id, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `hist_${crypto.randomUUID()}`,
    requestId,
    fromStatus,
    toStatus,
    actorType,
    actorId,
    note,
    new Date().toISOString()
  );
}

function validateBookingPayload(payload) {
  if (!payload || typeof payload !== "object") return "invalid_payload";
  if (!payload.consentAt || Number.isNaN(new Date(payload.consentAt).getTime())) return "consent_required";
  if (!["yes", "no"].includes(payload.firstTattoo)) return "invalid_first_tattoo";
  if (!["yes", "no", null, undefined].includes(payload.beenToMaster)) return "invalid_been_to_master";
  if (typeof payload.bodyZone !== "string" || typeof payload.bodySubzone !== "string" || !normalizeShortText(payload.bodyZone, 81) || !normalizeShortText(payload.bodySubzone, 81)) return "body_zone_required";
  if (payload.bodyZone.trim().length > 80 || payload.bodySubzone.trim().length > 80) return "body_zone_too_long";
  if (payload.bodyView && !["front", "back"].includes(payload.bodyView)) return "invalid_body_view";
  if (payload.sizePreset && !["XS", "S", "M", "L", "XL"].includes(payload.sizePreset)) return "invalid_size_preset";
  if (payload.sizeCm !== null && payload.sizeCm !== undefined && payload.sizeCm !== "" && (!Number.isInteger(Number(payload.sizeCm)) || Number(payload.sizeCm) < 1 || Number(payload.sizeCm) > 100)) return "invalid_size";
  if (payload.ideaText !== undefined && (typeof payload.ideaText !== "string" || payload.ideaText.length > 2000)) return "idea_too_long";
  if (payload.sketchComment !== undefined && (typeof payload.sketchComment !== "string" || payload.sketchComment.length > 500)) return "invalid_sketch_comment";
  if (!Array.isArray(payload.attachments)) return "invalid_attachments";
  if (payload.attachments.length > 4) return "too_many_attachments";
  const attachmentTooLarge = payload.attachments.some((attachment) => {
    const parsed = parseDataUrl(attachment?.dataUrl);
    return !parsed || parsed.buffer.length > maxAttachmentBytes();
  });
  if (attachmentTooLarge) return "invalid_attachment";
  return validateContact(payload);
}

function createPublicCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `BC${randomCode(6)}`;
    const existing = db.prepare("SELECT id FROM booking_requests WHERE public_code = ?").get(code);
    if (!existing) return code;
  }
  return `BC${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function masterCardText(payload) {
  const experience = payload.firstTattoo === "yes" ? "первая татуировка" : "уже есть татуировки";
  const master = payload.firstTattoo === "no"
    ? (payload.beenToMaster === "yes" ? "да" : "нет")
    : "не применимо";
  const sketch = payload.hasSketch ? "есть эскиз" : "нужна разработка";
  const side = payload.bodyView === "back" ? "сзади" : "спереди";
  const idea = normalizeText(payload.ideaText) || "Опишет в переписке";

  return [
    `Новая заявка Black Carp #${payload.publicCode}`,
    "",
    "Статус: новая заявка с сайта",
    payload.clientName ? `Клиент: ${payload.clientName}` : null,
    payload.contactValue ? `Контакт: ${payload.contactValue}` : null,
    payload.telegramUser ? `Telegram: ${payload.telegramUser}` : null,
    "",
    `Опыт: ${experience}`,
    `У мастера ранее: ${master}`,
    `Эскиз: ${sketch}`,
    `Зона: ${payload.bodyZone} / ${payload.bodySubzone} / ${side}`,
    `Размер: ${payload.sizeCm ? `${payload.sizePreset || "без пресета"}, около ${payload.sizeCm} см` : "не выбран"}`,
    `Оценка: ${payload.priceEstimate}`,
    "",
    "Идея:",
    idea,
    "",
    `Вложения: ${payload.attachmentCount || 0}`
  ].filter((line) => line !== null).join("\n");
}

function bookingPayloadFromRow(row) {
  return {
    firstTattoo: row.first_tattoo,
    beenToMaster: row.been_to_master,
    hasSketch: Boolean(row.has_sketch),
    bodyZone: row.body_zone,
    bodySubzone: row.body_subzone,
    bodyView: row.body_view,
    sizePreset: row.size_preset,
    sizeCm: row.size_cm,
    ideaText: row.idea_text,
    priceEstimate: row.price_estimate
  };
}

function estimatePrice(payload) {
  const sizeCm = Number(payload.sizeCm) || 0;
  if (!sizeCm) return "После консультации";
  if (payload.sizePreset === "XL" || sizeCm >= 25) {
    if (["Рукав", "Штанина", "Вся спина"].includes(payload.bodySubzone)) return "от 35 000 ₽";
    return "от 25 000 ₽";
  }
  if (sizeCm <= 5) return "7 000 - 9 000 ₽";
  if (sizeCm <= 10) return "9 000 - 12 000 ₽";
  if (sizeCm <= 15) return "12 000 - 18 000 ₽";
  if (sizeCm <= 20) return "18 000 - 25 000 ₽";
  return "от 25 000 ₽";
}

function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function schemaSql() {
  return `
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      telegram_user_id INTEGER UNIQUE,
      telegram_chat_id INTEGER,
      telegram_username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS booking_requests (
      id TEXT PRIMARY KEY,
      public_code TEXT NOT NULL UNIQUE,
      idempotency_key TEXT UNIQUE,
      client_id TEXT REFERENCES clients(id),
      status TEXT NOT NULL DEFAULT 'new',
      source TEXT NOT NULL DEFAULT 'website',
      first_tattoo TEXT NOT NULL,
      been_to_master TEXT,
      has_sketch INTEGER NOT NULL DEFAULT 0,
      sketch_comment TEXT,
      body_zone TEXT NOT NULL,
      body_subzone TEXT NOT NULL,
      body_view TEXT NOT NULL DEFAULT 'front',
      size_preset TEXT,
      size_cm INTEGER,
      idea_text TEXT,
      price_estimate TEXT,
      consent_at TEXT,
      submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      telegram_opened_at TEXT,
      master_notified_at TEXT,
      master_notify_error TEXT,
      client_ip_hash TEXT,
      user_agent_hash TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS booking_attachments (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('sketch', 'reference')),
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('client', 'master', 'system')),
      actor_id TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS telegram_updates (
      id TEXT PRIMARY KEY,
      update_id INTEGER NOT NULL UNIQUE,
      request_id TEXT REFERENCES booking_requests(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status);
    CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at ON booking_requests(created_at);
    CREATE INDEX IF NOT EXISTS idx_booking_requests_client_id ON booking_requests(client_id);
    CREATE INDEX IF NOT EXISTS idx_booking_requests_idempotency ON booking_requests(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_attachments_request_id ON booking_attachments(request_id);
    CREATE INDEX IF NOT EXISTS idx_status_history_request_id ON status_history(request_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_updates_request_id ON telegram_updates(request_id);
  `;
}

function telegramStartUrl(publicCode) {
  return `https://t.me/${botUsername}?start=${encodeURIComponent(publicCode)}`;
}

function siteUrl() {
  return String(process.env.SITE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, "");
}

function telegramApiBase() {
  return String(process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, "");
}

async function telegramRequest(method, payload) {
  const body = JSON.stringify(payload);
  const apiIp = String(process.env.TELEGRAM_API_IP || "").trim();

  if (apiIp) {
    return telegramRequestViaIp(method, body, apiIp);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.TELEGRAM_TIMEOUT_MS || 15000));
  let response;
  try {
    response = await fetch(`${telegramApiBase()}/bot${process.env.BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal
    });
  } catch (error) {
    throw new Error(error?.name === "AbortError" ? "telegram_timeout" : String(error?.message || error));
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.description || `telegram_${response.status}`);
  }
  return data;
}

function telegramRequestViaIp(method, body, apiIp) {
  return new Promise((resolve, reject) => {
    const request = https.request({
      host: apiIp,
      servername: "api.telegram.org",
      method: "POST",
      path: `/bot${process.env.BOT_TOKEN}/${method}`,
      headers: {
        "Host": "api.telegram.org",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      },
      timeout: Number(process.env.TELEGRAM_TIMEOUT_MS || 15000)
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        responseBody += chunk;
      });
      response.on("end", () => {
        const data = parseJson(responseBody);
        if (response.statusCode < 200 || response.statusCode >= 300 || data.ok === false) {
          reject(new Error(data.description || `telegram_${response.statusCode}`));
          return;
        }
        resolve(data);
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error("telegram_timeout"));
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function masterIds() {
  return String(process.env.MASTER_CHAT_IDS || process.env.MASTER_CHAT_ID || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requiredConfiguration() {
  const missing = ["BOT_TOKEN", "WEBHOOK_SECRET", "DEPLOY_PROBE_TOKEN", "SITE_URL", "ALLOWED_ORIGINS"]
    .filter((key) => !String(process.env[key] || "").trim());
  if (!masterIds().length) missing.push("MASTER_CHAT_IDS");
  if (!masterTelegramIds().length) missing.push("MASTER_TELEGRAM_IDS");
  if (process.env.NODE_ENV === "production" && !String(process.env.TRUST_PROXY || "").trim()) missing.push("TRUST_PROXY");
  if (process.env.NODE_ENV === "production") {
    const runtimeRevision = String(process.env.RELEASE_SHA || "").trim();
    if (!/^[a-f0-9]{40}$/i.test(buildRevision) || runtimeRevision !== buildRevision) missing.push("RELEASE_SHA");
  }
  return missing;
}

function releaseSha() {
  return buildRevision || String(process.env.RELEASE_SHA || "unknown").trim();
}

function readBuildRevision() {
  try {
    const value = fs.readFileSync(path.join(rootDir, "REVISION"), "utf8").trim();
    return /^[a-f0-9]{40}$/i.test(value) ? value : "";
  } catch {
    return "";
  }
}

function requireDeployProbeToken(req, res, next) {
  const expected = Buffer.from(String(process.env.DEPLOY_PROBE_TOKEN || ""));
  const provided = Buffer.from(String(req.get("X-Black-Carp-Probe-Token") || ""));
  if (!expected.length || expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return res.status(403).json({ ok:false, error:"forbidden" });
  }
  next();
}

function configuredTrustProxy() {
  const value = String(process.env.TRUST_PROXY || "").trim();
  if (!value || value === "false") return false;
  if (value === "true" || /^\d+$/.test(value)) {
    throw new Error("TRUST_PROXY must name trusted proxy ranges; blanket or hop-count trust is not allowed");
  }
  return value;
}

function requireWebhookSecret(req, res, next) {
  if (!process.env.WEBHOOK_SECRET && process.env.NODE_ENV !== "test") {
    return res.status(503).json({ ok: false, error: "webhook_not_configured" });
  }
  const secret = req.get("X-Telegram-Bot-Api-Secret-Token");
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  next();
}

function bookingRateLimit(req, res, next) {
  const now = Date.now();
  const windowMs = Math.max(60_000, Number(process.env.BOOKING_RATE_WINDOW_MS || 15 * 60_000));
  const limit = Math.max(1, Number(process.env.BOOKING_RATE_LIMIT || 8));
  const key = req.ip || req.socket?.remoteAddress || "unknown";
  const bucket = bookingRateBuckets.get(key);
  const current = !bucket || bucket.resetAt <= now ? { count: 0, resetAt: now + windowMs } : bucket;
  current.count += 1;
  bookingRateBuckets.set(key, current);
  res.setHeader("RateLimit-Limit", String(limit));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - current.count)));
  res.setHeader("RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));
  if (bookingRateBuckets.size > 5000) {
    for (const [itemKey, item] of bookingRateBuckets) if (item.resetAt <= now) bookingRateBuckets.delete(itemKey);
  }
  if (current.count > limit) return res.status(429).json({ ok: false, error: "rate_limited" });
  next();
}

function cors(req, res, next) {
  const allowed = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const origin = req.get("origin");
  if (origin && (allowed.includes(origin) || (allowed.length === 0 && process.env.NODE_ENV !== "production"))) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Telegram-Bot-Api-Secret-Token,X-Telegram-Init-Data,X-Test-Master-Id");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

function securityHeaders(req, res, next) {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self'; frame-src https://yandex.ru; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

function formatTelegramUser(user) {
  if (!user) return "неизвестно";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const username = user.username ? `@${user.username}` : "";
  return [username, name, `id:${user.id}`].filter(Boolean).join(" ");
}

function randomCode(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...crypto.randomBytes(length)].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function normalizeText(value) {
  return String(value || "").trim().slice(0, 2000);
}

function mimeExtension(mimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function sha256(value) {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function runMigrations(database) {
  const currentVersion = Number(database.prepare("PRAGMA user_version").get().user_version || 0);
  assertSupportedDatabaseVersion(database);
  if (currentVersion === LATEST_SCHEMA_VERSION) return;

  database.exec("BEGIN IMMEDIATE");
  try {
    if (currentVersion < 1) migrateToVersion1(database);
    if (currentVersion < 2) migrateToVersion2(database);
    database.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION}; COMMIT`);
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch {}
    throw error;
  }
}

function assertSupportedDatabaseVersion(database) {
  const version = Number(database.prepare("PRAGMA user_version").get().user_version || 0);
  if (version > LATEST_SCHEMA_VERSION) throw new Error(`unsupported_database_version:${version}`);
}

function migrateToVersion1(database) {
  const columns = new Set(database.prepare("PRAGMA table_info(booking_requests)").all().map((row) => row.name));
  const additions = [
    ["client_name", "TEXT"],
    ["contact_type", "TEXT"],
    ["contact_value", "TEXT"],
    ["contact_comment", "TEXT"],
    ["scheduled_at", "TEXT"],
    ["duration_minutes", "INTEGER"],
    ["schedule_comment", "TEXT"],
    ["crm_updated_at", "TEXT"]
  ];
  for (const [name, definition] of additions) {
    if (!columns.has(name)) database.exec(`ALTER TABLE booking_requests ADD COLUMN ${name} ${definition}`);
  }
  database.exec(`
    UPDATE booking_requests SET status = CASE status
      WHEN 'submitted' THEN 'new'
      WHEN 'awaiting_client_start' THEN 'new'
      WHEN 'client_linked' THEN 'new'
      WHEN 'master_notified' THEN 'new'
      WHEN 'master_notify_failed' THEN 'new'
      WHEN 'consultation_offered' THEN 'approved'
      WHEN 'consultation_scheduled' THEN 'scheduled'
      WHEN 'closed' THEN 'done'
      WHEN 'spam' THEN 'cancelled'
      ELSE status END
    WHERE status IN ('submitted','awaiting_client_start','client_linked','master_notified','master_notify_failed','consultation_offered','consultation_scheduled','closed','spam');
    UPDATE booking_requests SET crm_updated_at = COALESCE(crm_updated_at, updated_at, created_at);
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS crm_notes (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
      master_telegram_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS crm_activity (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notification_outbox (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES booking_requests(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      recipient_chat_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL,
      last_error TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_crm_notes_request_id ON crm_notes(request_id);
    CREATE INDEX IF NOT EXISTS idx_crm_activity_request_id ON crm_activity(request_id);
    CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending ON notification_outbox(status, next_attempt_at);
  `);
  const outboxColumns = new Set(database.prepare("PRAGMA table_info(notification_outbox)").all().map((row) => row.name));
  if (!outboxColumns.has("recipient_chat_id")) database.exec("ALTER TABLE notification_outbox ADD COLUMN recipient_chat_id TEXT");
  const defaultRecipient = masterIds()[0] || null;
  if (defaultRecipient) database.prepare("UPDATE notification_outbox SET recipient_chat_id=? WHERE recipient_chat_id IS NULL").run(defaultRecipient);
}

function migrateToVersion2(database) {
  const columns = new Set(database.prepare("PRAGMA table_info(notification_outbox)").all().map((row) => row.name));
  for (const [name, definition] of [
    ["payload_json", "TEXT"],
    ["claim_token", "TEXT"],
    ["claimed_at", "TEXT"]
  ]) {
    if (!columns.has(name)) database.exec(`ALTER TABLE notification_outbox ADD COLUMN ${name} ${definition}`);
  }
}

function backupDatabaseBeforeMigration(database, existed) {
  if (!existed || process.env.NODE_ENV === "test") return;
  const version = database.prepare("PRAGMA user_version").get().user_version;
  if (version >= LATEST_SCHEMA_VERSION) return;
  const backupDir = path.join(path.dirname(dbPath), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  fs.chmodSync(backupDir, 0o700);
  const backupPath = path.join(backupDir, `black-carp-pre-v${LATEST_SCHEMA_VERSION}-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`);
  database.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  fs.chmodSync(backupPath, 0o600);
}

function recoverStaleOutboxClaims(database) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - outboxClaimLeaseMs()).toISOString();
  database.prepare(`
    UPDATE notification_outbox
    SET status='retry_wait', next_attempt_at=?, claim_token=NULL, claimed_at=NULL, updated_at=?
    WHERE status='sending' AND COALESCE(claimed_at, updated_at) <= ?
  `).run(now.toISOString(), now.toISOString(), cutoff);
}

function normalizeShortText(value, maxLength = 2000) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeContactName(value) {
  return normalizeShortText(value, 80);
}

function normalizeContactValue(value, type) {
  const normalized = normalizeShortText(value, 120);
  if (type === "telegram") return `@${normalized.replace(/^@+/, "")}`;
  return normalized;
}

function validateContact(payload) {
  const name = normalizeContactName(payload.clientName);
  const type = String(payload.contactType || "");
  const value = normalizeContactValue(payload.contactValue, type);
  if (name.length < 2) return "client_name_required";
  if (!["telegram", "phone", "other"].includes(type)) return "invalid_contact_type";
  if (value.length < 3) return "contact_required";
  if (type === "telegram" && !/^@[A-Za-z0-9_]{5,32}$/.test(value)) return "invalid_telegram_contact";
  if (type === "phone") {
    const digits = value.match(/\d/g) || [];
    if (!/^[+\d\s()-]+$/.test(value) || digits.length < 7 || digits.length > 15) return "invalid_phone_contact";
  }
  return null;
}

function masterTelegramIds() {
  return String(process.env.MASTER_TELEGRAM_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function crmWebAppUrl() {
  return String(process.env.CRM_WEBAPP_URL || `${siteUrl()}/crm`).replace(/\/$/, "");
}

function requireCrmAuth(req, res, next) {
  try {
    const testMasterId = req.get("X-Test-Master-Id");
    let master;
    if (process.env.NODE_ENV === "test" && testMasterId && masterTelegramIds().includes(String(testMasterId))) {
      master = { telegramId: String(testMasterId), name: "Test master" };
    } else {
      master = verifyTelegramInitData(req.get("X-Telegram-Init-Data"));
    }
    if (!master || !masterTelegramIds().includes(String(master.telegramId))) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    req.master = master;
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: "invalid_init_data" });
  }
}

function verifyTelegramInitData(initData) {
  if (!initData || !process.env.BOT_TOKEN) throw new Error("missing_init_data");
  const params = new URLSearchParams(initData);
  const providedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userJson = params.get("user");
  if (!providedHash || !userJson || !Number.isFinite(authDate)) throw new Error("invalid_init_data");
  if (Math.abs(Math.floor(Date.now() / 1000) - authDate) > 24 * 60 * 60) throw new Error("stale_init_data");
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN).digest();
  const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(providedHash, "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw new Error("invalid_signature");
  const user = JSON.parse(userJson);
  if (!user?.id) throw new Error("invalid_user");
  return { telegramId: String(user.id), name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "Мастер" };
}

function crmRequestById(id) {
  return db.prepare("SELECT * FROM booking_requests WHERE id = ? OR public_code = ?").get(id, id);
}

function crmListItem(row) {
  return {
    id: row.id,
    publicCode: row.public_code,
    status: row.status,
    clientName: row.client_name || "Без имени",
    contactValue: row.contact_value || "Контакт не указан",
    bodyZone: row.body_zone,
    bodySubzone: row.body_subzone,
    sizeCm: row.size_cm,
    hasSketch: Boolean(row.has_sketch),
    hasAttachments: Boolean(row.has_attachments),
    createdAt: row.created_at
  };
}

function crmDetail(row) {
  const attachments = db.prepare("SELECT id, kind, mime_type, size_bytes, created_at FROM booking_attachments WHERE request_id = ? ORDER BY created_at").all(row.id)
    .map((item) => ({ id: item.id, kind: item.kind, mimeType: item.mime_type, sizeBytes: item.size_bytes, createdAt: item.created_at, url: `/api/crm/requests/${row.id}/attachments/${item.id}` }));
  const notes = db.prepare("SELECT id, master_telegram_id, text, created_at FROM crm_notes WHERE request_id = ? ORDER BY created_at DESC").all(row.id)
    .map((item) => ({ id: item.id, masterTelegramId: item.master_telegram_id, text: item.text, createdAt: item.created_at }));
  const activity = db.prepare("SELECT id, actor_type, actor_id, event_type, payload_json, created_at FROM crm_activity WHERE request_id = ? ORDER BY created_at DESC").all(row.id)
    .map((item) => ({ id: item.id, actorType: item.actor_type, actorId: item.actor_id, eventType: item.event_type, payload: parseJson(item.payload_json), createdAt: item.created_at }));
  return {
    id: row.id,
    publicCode: row.public_code,
    status: row.status,
    clientName: row.client_name || "Без имени",
    contactType: row.contact_type || null,
    contactValue: row.contact_value || null,
    contactComment: row.contact_comment || null,
    firstTattoo: row.first_tattoo,
    beenToMaster: row.been_to_master,
    hasSketch: Boolean(row.has_sketch),
    sketchComment: row.sketch_comment,
    bodyZone: row.body_zone,
    bodySubzone: row.body_subzone,
    bodyView: row.body_view,
    sizePreset: row.size_preset,
    sizeCm: row.size_cm,
    ideaText: row.idea_text,
    priceEstimate: row.price_estimate,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    scheduleComment: row.schedule_comment,
    createdAt: row.created_at,
    updatedAt: row.crm_updated_at || row.updated_at,
    attachments,
    notes,
    activity
  };
}

function appendCrmActivity(requestId, actorType, actorId, eventType, payload) {
  const activityId = `act_${crypto.randomUUID()}`;
  db.prepare("INSERT INTO crm_activity (id, request_id, actor_type, actor_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(activityId, requestId, actorType, actorId || null, eventType, payload ? JSON.stringify(payload) : null, new Date().toISOString());
  return activityId;
}

function withTransaction(callback) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  }
}

function canTransition(from, to) {
  return (CRM_TRANSITIONS[from] || []).includes(to);
}

function validDateFilter(value) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(value) {
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    return parsed?.createdAt && parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, "\\$&");
}

function absoluteAttachmentPath(relativePath) {
  const absolute = path.resolve(rootDir, String(relativePath || ""));
  const root = path.resolve(uploadsDir) + path.sep;
  return absolute.startsWith(root) ? absolute : null;
}

function cleanupRequestFiles(requestId) {
  const target = path.join(uploadsDir, requestId);
  fs.rmSync(target, { recursive: true, force: true });
}

function hardenRuntimePermissions() {
  for (const directory of [dataDir, uploadsDir]) {
    fs.chmodSync(directory, 0o700);
    hardenTree(directory);
  }
  for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
    if (fs.existsSync(file)) fs.chmodSync(file, 0o600);
  }
}

function hardenTree(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes:true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      fs.chmodSync(target, 0o700);
      hardenTree(target);
    } else if (entry.isFile()) {
      fs.chmodSync(target, 0o600);
    }
  }
}

function maxAttachmentBytes() {
  return Math.max(256 * 1024, Math.min(Number(process.env.MAX_ATTACHMENT_BYTES || 5 * 1024 * 1024), 10 * 1024 * 1024));
}

function enqueueMasterNotification(requestId, now) {
  return enqueueNotification(requestId, "master_new_request", null, now);
}

function enqueueClientMessageNotification(requestId, payload, now) {
  return enqueueNotification(requestId, "client_message", payload, now);
}

function enqueueNotification(requestId, kind, payload, now) {
  const recipients = masterIds().length ? masterIds() : [null];
  const insert = db.prepare(`
    INSERT INTO notification_outbox (
      id, request_id, kind, recipient_chat_id, payload_json,
      status, attempts, next_attempt_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)
  `);
  return recipients.map((recipient) => {
    const id = `out_${crypto.randomUUID()}`;
    insert.run(id, requestId, kind, recipient, payload ? JSON.stringify(payload) : null, now, now, now);
    return id;
  });
}

async function deliverPendingNotification(requestId) {
  const outboxes = db.prepare("SELECT id FROM notification_outbox WHERE request_id = ? AND kind='master_new_request' AND status IN ('pending','retry_wait') ORDER BY created_at ASC").all(requestId);
  return deliverOutboxIds(outboxes.map((outbox) => outbox.id), true);
}

async function deliverOutboxIds(outboxIds, emptyIsSuccess = false) {
  if (!outboxIds.length) return { ok: emptyIsSuccess, error: emptyIsSuccess ? undefined : "no_recipients" };
  const results = await Promise.all(outboxIds.map((outboxId) => deliverOutbox(outboxId)));
  return results.find((item) => item.ok) || results[0];
}

async function deliverDueOutbox() {
  recoverStaleOutboxClaims(db);
  const due = db.prepare("SELECT id FROM notification_outbox WHERE status IN ('pending','retry_wait') AND next_attempt_at <= ? ORDER BY next_attempt_at ASC LIMIT 20")
    .all(new Date().toISOString());
  const results = await Promise.allSettled(due.map((item) => deliverOutbox(item.id)));
  for (const result of results) {
    if (result.status === "rejected") console.error("outbox_delivery_error", result.reason);
  }
  return results;
}

async function deliverOutbox(outboxId) {
  const outbox = db.prepare("SELECT * FROM notification_outbox WHERE id = ?").get(outboxId);
  if (!outbox) return { ok: false };
  if (!["pending", "retry_wait"].includes(outbox.status)) return { ok: outbox.status === "sent", error: "not_pending" };
  const request = crmRequestById(outbox.request_id);
  if (!request) return { ok: false };
  const now = new Date().toISOString();
  const claimToken = crypto.randomUUID();
  const claimed = db.prepare("UPDATE notification_outbox SET status='sending', attempts=attempts+1, claim_token=?, claimed_at=?, updated_at=? WHERE id=? AND status IN ('pending','retry_wait')")
    .run(claimToken, now, now, outbox.id);
  if (claimed.changes === 0) return { ok: false, error: "already_claimed" };
  const result = await deliverOutboxNotification(outbox, request);
  const completedAt = new Date().toISOString();
  if (result.ok) {
    const committed = withTransaction(() => {
      const updated = db.prepare("UPDATE notification_outbox SET status='sent', sent_at=?, last_error=NULL, claim_token=NULL, claimed_at=NULL, updated_at=? WHERE id=? AND status='sending' AND claim_token=?")
        .run(completedAt, completedAt, outbox.id, claimToken);
      if (updated.changes === 0) return false;
      if (outbox.kind === "master_new_request") {
        const remaining = db.prepare("SELECT COUNT(*) AS count FROM notification_outbox WHERE request_id=? AND kind='master_new_request' AND status!='sent'").get(request.id).count;
        db.prepare("UPDATE booking_requests SET master_notified_at=COALESCE(master_notified_at, ?), master_notify_error=CASE WHEN ? THEN master_notify_error ELSE NULL END, updated_at=? WHERE id=?")
          .run(completedAt, remaining ? 1 : 0, completedAt, request.id);
        appendCrmActivity(request.id, "system", null, "master_notified", { outboxId: outbox.id });
      } else if (outbox.kind === "client_message") {
        updateClientMessageDelivery(outbox, true, null);
      }
      return true;
    });
    if (!committed) return { ok: false, error: "claim_lost" };
    return { ok: true };
  }
  const attempts = Number(outbox.attempts || 0) + 1;
  const delayMinutes = Math.min(60, 2 ** Math.min(attempts, 6));
  const nextAttempt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
  const lastError = String(result.error || "delivery_failed").slice(0, 500);
  const committed = withTransaction(() => {
    const updated = db.prepare("UPDATE notification_outbox SET status='retry_wait', next_attempt_at=?, last_error=?, claim_token=NULL, claimed_at=NULL, updated_at=? WHERE id=? AND status='sending' AND claim_token=?")
      .run(nextAttempt, lastError, completedAt, outbox.id, claimToken);
    if (updated.changes === 0) return false;
    if (outbox.kind === "master_new_request") {
      db.prepare("UPDATE booking_requests SET master_notify_error=?, updated_at=? WHERE id=?").run(lastError, completedAt, request.id);
      appendCrmActivity(request.id, "system", null, "master_notify_failed", { outboxId: outbox.id, error: result.error || "delivery_failed" });
    } else if (outbox.kind === "client_message") {
      updateClientMessageDelivery(outbox, false, lastError);
    }
    return true;
  });
  if (!committed) return { ok: false, error: "claim_lost" };
  return { ok: false, error: result.error };
}

async function deliverOutboxNotification(outbox, request) {
  if (outbox.kind === "master_new_request") {
    const attachmentCount = db.prepare("SELECT COUNT(*) AS count FROM booking_attachments WHERE request_id=?").get(request.id).count;
    return notifyMaster({ ...bookingPayloadFromRow(request), requestId: request.id, publicCode: request.public_code, clientName: request.client_name, contactValue: request.contact_value, attachmentCount }, outbox.recipient_chat_id);
  }
  if (outbox.kind === "client_message") {
    const payload = parseJson(outbox.payload_json);
    if (!payload.text) return { ok: false, error: "invalid_outbox_payload" };
    return sendTelegramMessage(outbox.recipient_chat_id, [
      `Дополнительный комментарий к заявке #${request.public_code}`,
      `Клиент: ${payload.clientLabel || "неизвестно"}`,
      "",
      payload.text
    ].join("\n"));
  }
  return { ok: false, error: "unsupported_outbox_kind" };
}

function updateClientMessageDelivery(outbox, delivered, error) {
  const outboxPayload = parseJson(outbox.payload_json);
  if (!outboxPayload.activityId) return;
  const activity = db.prepare("SELECT payload_json FROM crm_activity WHERE id=? AND request_id=?").get(outboxPayload.activityId, outbox.request_id);
  if (!activity) return;
  const payload = parseJson(activity.payload_json);
  if (delivered) {
    payload.delivered = true;
    payload.delivery = "delivered";
    delete payload.lastError;
  } else if (!payload.delivered) {
    payload.delivered = false;
    payload.delivery = "queued";
    payload.lastError = error;
  }
  db.prepare("UPDATE crm_activity SET payload_json=? WHERE id=?").run(JSON.stringify(payload), outboxPayload.activityId);
}

function outboxClaimLeaseMs() {
  return 5 * 60_000;
}
