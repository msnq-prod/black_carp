const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const rootDir = __dirname;
loadEnvFile(path.join(rootDir, ".env"));

const dataDir = path.join(rootDir, "data");
const uploadsDir = path.join(rootDir, "uploads", "booking");
const dbPath = process.env.DB_PATH || path.join(dataDir, "black-carp.sqlite");
const port = Number(process.env.PORT || 3001);
const botUsername = (process.env.BOT_USERNAME || "blackcarp_bot").replace(/^@/, "");

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec(schemaSql());

app.use(express.json({ limit: process.env.JSON_LIMIT || "25mb" }));
app.use(cors);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/booking/submit", async (req, res) => {
  try {
    const payload = req.body;
    const validationError = validateBookingPayload(payload);
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const existing = payload.idempotencyKey
      ? db.prepare("SELECT id, public_code FROM booking_requests WHERE idempotency_key = ?").get(payload.idempotencyKey)
      : null;

    if (existing) {
      return res.json({
        ok: true,
        requestId: existing.id,
        publicCode: existing.public_code,
        telegramUrl: telegramStartUrl(existing.public_code),
        duplicate: true
      });
    }

    const requestId = `req_${crypto.randomUUID()}`;
    const publicCode = createPublicCode();
    const now = new Date().toISOString();
    const priceEstimate = String(payload.priceEstimate || estimatePrice(payload));
    const attachments = saveAttachments(requestId, payload.attachments || []);

    db.prepare(`
      INSERT INTO booking_requests (
        id, public_code, idempotency_key, status, source,
        first_tattoo, been_to_master, has_sketch, sketch_comment,
        body_zone, body_subzone, body_view, size_preset, size_cm,
        idea_text, price_estimate, consent_at, submitted_at,
        client_ip_hash, user_agent_hash, created_at, updated_at
      )
      VALUES (?, ?, ?, 'submitted', 'website', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      requestId,
      publicCode,
      payload.idempotencyKey || null,
      payload.firstTattoo,
      payload.beenToMaster || null,
      payload.hasSketch ? 1 : 0,
      normalizeText(payload.sketchComment),
      payload.bodyZone,
      payload.bodySubzone,
      payload.bodyView || "front",
      payload.sizePreset || null,
      payload.sizeCm ? Number(payload.sizeCm) : null,
      normalizeText(payload.ideaText),
      priceEstimate,
      payload.consentAt || now,
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

    appendStatus(requestId, null, "submitted", "system", null, "Анкета сохранена с сайта");

    const notifyResult = await notifyMaster({
      ...payload,
      requestId,
      publicCode,
      priceEstimate,
      attachmentCount: attachments.length
    });

    const nextStatus = notifyResult.ok ? "awaiting_client_start" : "master_notify_failed";
    db.prepare(`
      UPDATE booking_requests
      SET status = ?, master_notified_at = ?, master_notify_error = ?, updated_at = ?
      WHERE id = ?
    `).run(
      nextStatus,
      notifyResult.ok ? now : null,
      notifyResult.ok ? null : notifyResult.error,
      new Date().toISOString(),
      requestId
    );

    appendStatus(
      requestId,
      "submitted",
      nextStatus,
      "system",
      null,
      notifyResult.ok ? "Мастер уведомлен" : "Не удалось уведомить мастера"
    );

    res.json({
      ok: true,
      requestId,
      publicCode,
      telegramUrl: telegramStartUrl(publicCode),
      masterNotified: notifyResult.ok
    });
  } catch (error) {
    console.error("booking_submit_error", error);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
});

app.post("/telegram/webhook", async (req, res) => {
  try {
    if (process.env.WEBHOOK_SECRET) {
      const secret = req.get("X-Telegram-Bot-Api-Secret-Token");
      if (secret !== process.env.WEBHOOK_SECRET) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }
    }

    const update = req.body;
    if (typeof update.update_id === "number") {
      const seen = db.prepare("SELECT id FROM telegram_updates WHERE update_id = ?").get(update.update_id);
      if (seen) return res.json({ ok: true, duplicate: true });
    }

    let requestId = null;
    let eventType = "unknown";
    if (update.message?.text?.startsWith("/start")) {
      eventType = "start";
      requestId = await handleStart(update.message);
    } else if (update.callback_query) {
      eventType = "callback";
      requestId = await handleCallback(update.callback_query);
    }

    if (typeof update.update_id === "number") {
      db.prepare(`
        INSERT INTO telegram_updates (id, update_id, request_id, event_type, received_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(`upd_${crypto.randomUUID()}`, update.update_id, requestId, eventType, new Date().toISOString());
    }

    res.json({ ok: true });
  } catch (error) {
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
app.use("/editor", express.static(path.join(rootDir, "editor")));
app.use("/uploads", express.static(path.join(rootDir, "uploads")));

app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

for (const filename of ["index_v2.html", "styles.css", "styles_v2.css", "script.js", "script_v2.js"]) {
  app.get(`/${filename}`, (req, res) => {
    res.sendFile(path.join(rootDir, filename));
  });
}

app.listen(port, () => {
  console.log(`Black Carp server: http://127.0.0.1:${port}`);
  console.log(`API: http://127.0.0.1:${port}/api/booking/submit`);
});

async function handleStart(message) {
  const publicCode = message.text.split(/\s+/)[1]?.trim();
  if (!publicCode) {
    await sendTelegramMessage(message.chat.id, "Здравствуйте. Чтобы мастер получил анкету, заполните форму на сайте Black Carp.", {
      inline_keyboard: [[{ text: "Перейти к анкете", url: siteUrl() }]]
    });
    return null;
  }

  const booking = db.prepare("SELECT id, status FROM booking_requests WHERE public_code = ?").get(publicCode);
  if (!booking) {
    await sendTelegramMessage(message.chat.id, "Заявка не найдена. Пожалуйста, заполните анкету заново.", {
      inline_keyboard: [[{ text: "Перейти к анкете", url: `${siteUrl()}#/booking` }]]
    });
    return null;
  }

  const now = new Date().toISOString();
  const clientId = upsertClient(message.from, message.chat.id, now);
  db.prepare(`
    UPDATE booking_requests
    SET client_id = ?, status = 'client_linked', telegram_opened_at = ?, updated_at = ?
    WHERE id = ?
  `).run(clientId, now, now, booking.id);

  appendStatus(booking.id, booking.status, "client_linked", "client", String(message.from.id), "Клиент открыл Telegram-бота");

  await sendTelegramMessage(message.chat.id, [
    "Ваша анкета получена.",
    "",
    "Мастер уже видит идею, зону, размер и референсы.",
    "Здесь можно продолжить диалог и уточнить детали консультации."
  ].join("\n"), {
    inline_keyboard: [
      [{ text: "Открыть сайт", url: siteUrl() }],
      [{ text: "Заполнить заново", url: `${siteUrl()}#/booking` }]
    ]
  });

  await notifyMasterText([
    `Клиент открыл бота и связан с заявкой #${publicCode}.`,
    `Telegram: ${formatTelegramUser(message.from)}`
  ].join("\n"));

  return booking.id;
}

async function handleCallback(callback) {
  const fromId = String(callback.from?.id || "");
  if (!masterIds().includes(fromId)) {
    await answerCallback(callback.id, "Нет доступа");
    return null;
  }

  const [requestId, action] = String(callback.data || "").split(":");
  const nextStatus = {
    review: "in_review",
    details: "need_details",
    offer: "consultation_offered",
    close: "closed",
    spam: "spam"
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

  db.prepare("UPDATE booking_requests SET status = ?, updated_at = ? WHERE id = ?")
    .run(nextStatus, new Date().toISOString(), requestId);
  appendStatus(requestId, booking.status, nextStatus, "master", fromId, "Статус изменен кнопкой мастера");
  await answerCallback(callback.id, `Статус: ${nextStatus}`);
  return requestId;
}

function saveAttachments(requestId, attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return [];

  const requestDir = path.join(uploadsDir, requestId);
  fs.mkdirSync(requestDir, { recursive: true });

  return attachments.slice(0, 4).flatMap((attachment, index) => {
    const parsed = parseDataUrl(attachment.dataUrl);
    if (!parsed) return [];

    const kind = attachment.kind === "sketch" ? "sketch" : "reference";
    const filename = `${kind}-${index + 1}.${mimeExtension(parsed.mimeType)}`;
    const absolutePath = path.join(requestDir, filename);
    fs.writeFileSync(absolutePath, parsed.buffer);

    return [{
      id: `att_${crypto.randomUUID()}`,
      kind,
      filePath: path.relative(rootDir, absolutePath).replace(/\\/g, "/"),
      mimeType: parsed.mimeType,
      sizeBytes: parsed.buffer.length
    }];
  });
}

async function notifyMaster(payload) {
  if (!process.env.BOT_TOKEN || !masterIds().length) {
    return { ok: false, error: "bot_not_configured" };
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: "Взять в работу", callback_data: `${payload.requestId}:review` },
        { text: "Уточнить", callback_data: `${payload.requestId}:details` }
      ],
      [{ text: "Предложить консультацию", callback_data: `${payload.requestId}:offer` }],
      [
        { text: "Закрыть", callback_data: `${payload.requestId}:close` },
        { text: "Спам", callback_data: `${payload.requestId}:spam` }
      ]
    ]
  };

  return notifyMasterText(masterCardText(payload), replyMarkup);
}

async function notifyMasterText(text, replyMarkup) {
  if (!process.env.BOT_TOKEN || !masterIds().length) {
    return { ok: false, error: "bot_not_configured" };
  }

  const results = await Promise.all(masterIds().map((chatId) => sendTelegramMessage(chatId, text, replyMarkup)));
  return results.find((item) => !item.ok) || { ok: true };
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
  await telegramRequest("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
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
  if (!payload.consentAt) return "consent_required";
  if (!["yes", "no"].includes(payload.firstTattoo)) return "invalid_first_tattoo";
  if (!["yes", "no", null, undefined].includes(payload.beenToMaster)) return "invalid_been_to_master";
  if (!payload.bodyZone || !payload.bodySubzone) return "body_zone_required";
  if (payload.sizeCm && !Number(payload.sizeCm)) return "invalid_size";
  if (String(payload.ideaText || "").length > 2000) return "idea_too_long";
  if ((payload.attachments || []).length > 4) return "too_many_attachments";
  return null;
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
    "Статус: анкета отправлена, клиент переходит в Telegram",
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
  ].join("\n");
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
      status TEXT NOT NULL DEFAULT 'submitted',
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

  const response = await fetch(`${telegramApiBase()}/bot${process.env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  });
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

function cors(req, res, next) {
  const allowed = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const origin = req.get("origin");
  if (!origin || allowed.length === 0 || allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Telegram-Bot-Api-Secret-Token");
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") return res.sendStatus(204);
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
