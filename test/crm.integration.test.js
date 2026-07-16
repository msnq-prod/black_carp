const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const http = require("node:http");
const { spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const dbPath = path.join(os.tmpdir(), `black-carp-test-${process.pid}.sqlite`);
process.env.NODE_ENV = "test";
process.env.DB_PATH = dbPath;
process.env.MASTER_TELEGRAM_IDS = "100";
process.env.MASTER_CHAT_IDS = "100,200";
process.env.BOT_TOKEN = "test-token";
process.env.WEBHOOK_SECRET = "test-secret";
process.env.DEPLOY_PROBE_TOKEN = "test-probe-secret";
process.env.RELEASE_SHA = "test-release";
process.env.CRM_WEBAPP_URL = "https://black-carp.test/crm";
process.env.SITE_URL = "https://black-carp.test";
process.env.ALLOWED_ORIGINS = "https://black-carp.test";
process.env.TRUST_PROXY = "loopback";
process.env.TELEGRAM_TRANSPORT = "webhook";

const { app, db, deliverDueOutbox } = require("../server");
let server;
let telegramServer;
let baseUrl;
let primaryRequest;
const telegramCalls = [];
const telegramAttempts = new Map();
let failAllTelegram = false;
let telegramResponseDelayMs = 0;
let telegramWebhookUrl = "https://black-carp.test/telegram/webhook";

test.before(async () => {
  telegramServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const payload = JSON.parse(body || "{}");
      telegramCalls.push(payload);
      const chatId = String(payload.chat_id || "service");
      const attempt = (telegramAttempts.get(chatId) || 0) + 1;
      telegramAttempts.set(chatId, attempt);
      const shouldFail = failAllTelegram || (chatId === "200" && attempt === 1);
      setTimeout(() => {
        res.writeHead(shouldFail ? 500 : 200, { "Content-Type": "application/json" });
        const result = req.url.endsWith("/getWebhookInfo")
          ? { url:telegramWebhookUrl }
          : { message_id:telegramCalls.length };
        res.end(JSON.stringify(shouldFail ? { ok:false, description:"temporary" } : { ok:true, result }));
      }, telegramResponseDelayMs);
    });
  }).listen(0, "127.0.0.1");
  await new Promise((resolve) => telegramServer.once("listening", resolve));
  process.env.TELEGRAM_API_BASE = `http://127.0.0.1:${telegramServer.address().port}`;
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => telegramServer.close(resolve));
  db.close();
  for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) fs.rmSync(file, { force: true });
});

test("complete booking, bot, CRM, attachment and outbox flow", async () => {
  const bookingPayload = {
    idempotencyKey: "test-key-1", consentAt: new Date().toISOString(), firstTattoo: "yes", beenToMaster: null,
    hasSketch: false, bodyZone: "Рука", bodySubzone: "Предплечье", bodyView: "front", sizeCm: 12,
    ideaText: "Тестовая заявка", priceEstimate: "1 ₽", clientName: "Анна", contactType: "telegram", contactValue: "@annaa",
    attachments: [{ kind:"reference", dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5WQAAAABJRU5ErkJggg==" }]
  };
  const booking = await fetch(`${baseUrl}/api/booking/submit`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(bookingPayload) });
  const created = await booking.json();
  primaryRequest = created;
  assert.equal(booking.status, 200); assert.equal(created.status, "new"); assert.equal(created.masterNotified, true);
  const newRequestCalls = telegramCalls.filter((item) => item.reply_markup?.inline_keyboard?.[0]?.[0]?.web_app);
  assert.equal(newRequestCalls.length, 2);
  assert.equal(newRequestCalls[0].reply_markup.inline_keyboard[0][0].web_app.url.endsWith(`/crm?request=${created.publicCode}`), true);

  const auth = { "X-Test-Master-Id": "100" };
  const failedOutbox = db.prepare("SELECT id FROM notification_outbox WHERE request_id=? AND recipient_chat_id='200'").get(created.requestId);
  const retried = await fetch(`${baseUrl}/api/crm/outbox/${failedOutbox.id}/retry`, { method:"POST", headers:auth });
  assert.equal(retried.status, 200);
  assert.equal(telegramCalls.filter((item) => String(item.chat_id) === "100" && item.reply_markup?.inline_keyboard).length, 1);

  const webhookHeaders = { "Content-Type":"application/json", "X-Telegram-Bot-Api-Secret-Token":"test-secret" };
  const start = await fetch(`${baseUrl}/telegram/webhook`, { method:"POST", headers:webhookHeaders, body:JSON.stringify({ update_id:101, message:{ text:`/start ${created.publicCode}`, chat:{ id:777 }, from:{ id:777, first_name:"Анна" } } }) });
  assert.equal(start.status, 200);
  assert.ok(db.prepare("SELECT client_id FROM booking_requests WHERE id=?").get(created.requestId).client_id);

  const callback = await fetch(`${baseUrl}/telegram/webhook`, { method:"POST", headers:webhookHeaders, body:JSON.stringify({ update_id:102, callback_query:{ id:"cb-1", data:`${created.requestId}:review`, from:{ id:100 } } }) });
  assert.equal(callback.status, 200);

  const list = await fetch(`${baseUrl}/api/crm/requests`, { headers: auth });
  const listData = await list.json();
  assert.equal(listData.items.length, 1); assert.equal(listData.items[0].clientName, "Анна"); assert.equal(listData.counts.in_review, 1);

  const note = await fetch(`${baseUrl}/api/crm/requests/${created.requestId}/notes`, { method:"POST", headers:{ ...auth, "Content-Type":"application/json" }, body:JSON.stringify({ text:"Уточнить композицию" }) });
  assert.equal(note.status, 201);
  const scheduledAt = new Date(Date.now() + 86_400_000).toISOString();
  const schedule = await fetch(`${baseUrl}/api/crm/requests/${created.requestId}/schedule`, { method:"PATCH", headers:{ ...auth, "Content-Type":"application/json" }, body:JSON.stringify({ scheduledAt, durationMinutes:180, comment:"Сеанс" }) });
  assert.equal(schedule.status, 200);
  const forbidden = await fetch(`${baseUrl}/api/crm/requests/${created.requestId}/status`, { method:"PATCH", headers:{ ...auth, "Content-Type":"application/json" }, body:JSON.stringify({ status:"in_review" }) });
  assert.equal(forbidden.status, 409);

  const detail = await (await fetch(`${baseUrl}/api/crm/requests/${created.requestId}`, { headers:auth })).json();
  assert.equal(detail.request.status, "scheduled"); assert.equal(detail.request.notes.length, 1); assert.equal(detail.request.attachments.length, 1);
  assert.notEqual(detail.request.priceEstimate, "1 ₽");
  assert.ok(detail.request.activity.some((event) => event.eventType === "schedule_changed"));
  const attachmentUrl = detail.request.attachments[0].url;
  assert.equal((await fetch(`${baseUrl}${attachmentUrl}`)).status, 401);
  const attachment = await fetch(`${baseUrl}${attachmentUrl}`, { headers:auth });
  assert.equal(attachment.status, 200); assert.equal(attachment.headers.get("content-type"), "image/png");

  const duplicate = await fetch(`${baseUrl}/api/booking/submit`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(bookingPayload) });
  const duplicateData = await duplicate.json();
  assert.equal(duplicateData.duplicate, true); assert.equal(duplicateData.status, "scheduled");
  fs.rmSync(path.join(__dirname, "..", "uploads", "booking", created.requestId), { recursive:true, force:true });
});

test("portfolio supports ordered private media and publishes a gallery", async () => {
  const auth = { "X-Test-Master-Id":"100", "Content-Type":"application/json" };
  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVR4nGNgYGD4D8UQBgAd9AP9yOH2qAAAAABJRU5ErkJggg==";
  const createdResponse = await fetch(`${baseUrl}/api/crm/portfolio`, {
    method:"POST", headers:auth,
    body:JSON.stringify({ title:"Black Wave", caption:"Спина", bodyZone:"Спина", style:"Графика", year:2026 })
  });
  assert.equal(createdResponse.status, 201);
  let created = (await createdResponse.json()).item;
  assert.equal(created.status, "draft");
  assert.equal(created.media.length, 0);
  assert.equal((await (await fetch(`${baseUrl}/api/portfolio`)).json()).items.length, 0);

  const firstUpload = await fetch(`${baseUrl}/api/crm/portfolio/${created.id}/media`, { method:"POST", headers:auth, body:JSON.stringify({ imageDataUrl:pixel, altText:"Первый ракурс татуировки" }) });
  assert.equal(firstUpload.status, 201);
  const first = (await firstUpload.json()).media;
  const secondUpload = await fetch(`${baseUrl}/api/crm/portfolio/${created.id}/media`, { method:"POST", headers:auth, body:JSON.stringify({ imageDataUrl:pixel, altText:"" }) });
  assert.equal(secondUpload.status, 201);
  const second = (await secondUpload.json()).media;
  assert.equal((await fetch(`${baseUrl}${first.imageUrl}`)).status, 401);
  const privateImage = await fetch(`${baseUrl}${first.thumbUrl}`, { headers:{ "X-Test-Master-Id":"100" } });
  assert.equal(privateImage.status, 200);
  assert.equal(privateImage.headers.get("content-type"), "image/webp");

  const incompletePublish = await fetch(`${baseUrl}/api/crm/portfolio/${created.id}/publish`, { method:"POST", headers:{ "X-Test-Master-Id":"100" } });
  assert.equal(incompletePublish.status, 409);
  const altUpdate = await fetch(`${baseUrl}/api/crm/portfolio/${created.id}/media/${second.id}`, { method:"PATCH", headers:auth, body:JSON.stringify({ altText:"Второй ракурс татуировки" }) });
  assert.equal(altUpdate.status, 200);
  const reordered = await fetch(`${baseUrl}/api/crm/portfolio/${created.id}/media/reorder`, { method:"POST", headers:auth, body:JSON.stringify({ ids:[second.id, first.id] }) });
  assert.equal(reordered.status, 200);

  const published = await fetch(`${baseUrl}/api/crm/portfolio/${created.id}/publish`, { method:"POST", headers:{ "X-Test-Master-Id":"100" } });
  assert.equal(published.status, 200);
  const publicItems = (await (await fetch(`${baseUrl}/api/portfolio`)).json()).items;
  assert.equal(publicItems.length, 1);
  assert.equal(publicItems[0].title, "Black Wave");
  assert.equal(publicItems[0].media.length, 2);
  assert.equal(publicItems[0].media[0].id, second.id);
  assert.equal(publicItems[0].imageUrl, publicItems[0].media[0].imageUrl);
  assert.equal((await fetch(`${baseUrl}${publicItems[0].imageUrl}`)).status, 200);

  const updated = await fetch(`${baseUrl}/api/crm/portfolio/${created.id}`, { method:"PATCH", headers:auth, body:JSON.stringify({ caption:"Обновлено" }) });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).item.caption, "Обновлено");
  const removed = await fetch(`${baseUrl}/api/crm/portfolio/${created.id}/media/${first.id}`, { method:"DELETE", headers:{ "X-Test-Master-Id":"100" } });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).item.media.length, 1);
  const archived = await fetch(`${baseUrl}/api/crm/portfolio/${created.id}/archive`, { method:"POST", headers:{ "X-Test-Master-Id":"100" } });
  assert.equal(archived.status, 200);
  assert.equal((await (await fetch(`${baseUrl}/api/portfolio`)).json()).items.length, 0);
  const files = db.prepare("SELECT original_path, display_path, thumb_path FROM portfolio_media WHERE portfolio_item_id=?").all(created.id);
  for (const file of files.flatMap((row) => [row.original_path, row.display_path, row.thumb_path])) fs.rmSync(path.join(__dirname, "..", file), { force:true });
});

test("Telegram start cannot rebind a booking to another user", async () => {
  const headers = { "Content-Type":"application/json", "X-Telegram-Bot-Api-Secret-Token":"test-secret" };
  const response = await fetch(`${baseUrl}/telegram/webhook`, {
    method:"POST",
    headers,
    body:JSON.stringify({ update_id:103, message:{ text:`/start ${primaryRequest.publicCode}`, chat:{ id:888 }, from:{ id:888, first_name:"Чужой" } } })
  });
  assert.equal(response.status, 200);
  const linked = db.prepare("SELECT c.telegram_user_id FROM booking_requests r JOIN clients c ON c.id=r.client_id WHERE r.id=?").get(primaryRequest.requestId);
  assert.equal(linked.telegram_user_id, 777);
  assert.ok(telegramCalls.some((item) => String(item.chat_id) === "888" && /уже связана/.test(item.text)));
});

test("client comments use durable outbox, concurrent retry and stale-claim recovery", async () => {
  failAllTelegram = true;
  const headers = { "Content-Type":"application/json", "X-Telegram-Bot-Api-Secret-Token":"test-secret" };
  const response = await fetch(`${baseUrl}/telegram/webhook`, {
    method:"POST",
    headers,
    body:JSON.stringify({ update_id:104, message:{ text:"Нужна синяя деталь", chat:{ id:777 }, from:{ id:777, first_name:"Анна" } } })
  });
  failAllTelegram = false;
  assert.equal(response.status, 200);
  const rows = db.prepare("SELECT id, recipient_chat_id, status FROM notification_outbox WHERE request_id=? AND kind='client_message' ORDER BY recipient_chat_id").all(primaryRequest.requestId);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.status), ["retry_wait", "retry_wait"]);
  assert.ok(telegramCalls.some((item) => String(item.chat_id) === "777" && /повторена автоматически/.test(item.text)));

  telegramResponseDelayMs = 50;
  const auth = { "X-Test-Master-Id":"100" };
  const before = telegramCalls.filter((item) => String(item.chat_id) === String(rows[0].recipient_chat_id) && /Дополнительный комментарий/.test(item.text)).length;
  const retries = await Promise.all([
    fetch(`${baseUrl}/api/crm/outbox/${rows[0].id}/retry`, { method:"POST", headers:auth }),
    fetch(`${baseUrl}/api/crm/outbox/${rows[0].id}/retry`, { method:"POST", headers:auth })
  ]);
  telegramResponseDelayMs = 0;
  assert.deepEqual(retries.map((item) => item.status).sort(), [200, 409]);
  const after = telegramCalls.filter((item) => String(item.chat_id) === String(rows[0].recipient_chat_id) && /Дополнительный комментарий/.test(item.text)).length;
  assert.equal(after - before, 1);

  const staleAt = new Date(Date.now() - 10 * 60_000).toISOString();
  db.prepare("UPDATE notification_outbox SET status='sending', claim_token='stale-claim', claimed_at=?, updated_at=?, next_attempt_at=? WHERE id=?")
    .run(staleAt, staleAt, staleAt, rows[1].id);
  await deliverDueOutbox();
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM notification_outbox WHERE request_id=? AND kind='client_message' AND status='sent'").get(primaryRequest.requestId).count, 2);
  const activity = db.prepare("SELECT payload_json FROM crm_activity WHERE request_id=? AND event_type='client_message'").get(primaryRequest.requestId);
  assert.equal(JSON.parse(activity.payload_json).delivery, "delivered");
});

test("CRM rejects access without Telegram WebApp authorization", async () => {
  const response = await fetch(`${baseUrl}/api/crm/requests`);
  assert.equal(response.status, 401);
});

test("CRM accepts signed Telegram WebApp authorization for configured master", async () => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "test-query",
    user: JSON.stringify({ id: 100, first_name: "Master" })
  });
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN).digest();
  params.set("hash", crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex"));
  const response = await fetch(`${baseUrl}/api/crm/me`, { headers: { "X-Telegram-Init-Data": params.toString() } });
  assert.equal(response.status, 200);
});

test("CRM rejects correctly signed Telegram WebApp authorization for foreign user", async () => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "foreign-query",
    user: JSON.stringify({ id: 999, first_name: "Foreign" })
  });
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN).digest();
  params.set("hash", crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex"));
  const response = await fetch(`${baseUrl}/api/crm/me`, { headers: { "X-Telegram-Init-Data": params.toString() } });
  assert.equal(response.status, 403);
});

test("CRM authorization never falls back to notification chat ids", async () => {
  const configuredMasters = process.env.MASTER_TELEGRAM_IDS;
  try {
    process.env.MASTER_TELEGRAM_IDS = "";
    const params = new URLSearchParams({
      auth_date: String(Math.floor(Date.now() / 1000)),
      query_id: "no-auth-fallback",
      user: JSON.stringify({ id: 100, first_name: "Chat recipient" })
    });
    const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
    const secret = crypto.createHmac("sha256", "WebAppData").update(process.env.BOT_TOKEN).digest();
    params.set("hash", crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex"));
    const response = await fetch(`${baseUrl}/api/crm/me`, { headers:{ "X-Telegram-Init-Data":params.toString() } });
    assert.equal(response.status, 403);
  } finally {
    process.env.MASTER_TELEGRAM_IDS = configuredMasters;
  }
});

test("booking remains saved when Telegram is fully unavailable", async () => {
  failAllTelegram = true;
  const response = await fetch(`${baseUrl}/api/booking/submit`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({
    idempotencyKey:"all-down", consentAt:new Date().toISOString(), firstTattoo:"no", beenToMaster:"no", hasSketch:false,
    bodyZone:"Спина", bodySubzone:"Лопатки", bodyView:"back", ideaText:"Тест отказа Telegram",
    clientName:"Иван", contactType:"phone", contactValue:"+7 900 000-00-00", attachments:[]
  }) });
  const data = await response.json();
  failAllTelegram = false;
  assert.equal(response.status, 200);
  assert.equal(data.masterNotified, false);
  assert.equal(db.prepare("SELECT status FROM booking_requests WHERE id=?").get(data.requestId).status, "new");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM notification_outbox WHERE request_id=? AND status='retry_wait'").get(data.requestId).count, 2);
});

test("Telegram webhook requires its secret and deduplicates updates", async () => {
  const body = JSON.stringify({ update_id: 555 });
  const denied = await fetch(`${baseUrl}/telegram/webhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  assert.equal(denied.status, 403);
  const headers = { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": "test-secret" };
  const deniedBeforeParsing = await fetch(`${baseUrl}/telegram/webhook`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:"{" });
  assert.equal(deniedBeforeParsing.status, 403);
  const malformed = await fetch(`${baseUrl}/telegram/webhook`, { method:"POST", headers, body:"{" });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error, "invalid_json");
  const accepted = await fetch(`${baseUrl}/telegram/webhook`, { method: "POST", headers, body });
  const duplicate = await fetch(`${baseUrl}/telegram/webhook`, { method: "POST", headers, body });
  assert.equal(accepted.status, 200);
  assert.equal((await duplicate.json()).duplicate, true);

  db.prepare("INSERT INTO telegram_updates (id, update_id, event_type, received_at) VALUES ('failed-test', 556, 'failed', ?)").run(new Date().toISOString());
  const failedRetry = await fetch(`${baseUrl}/telegram/webhook`, { method:"POST", headers, body:JSON.stringify({ update_id:556 }) });
  assert.equal(failedRetry.status, 200);
  db.prepare("INSERT INTO telegram_updates (id, update_id, event_type, received_at) VALUES ('lease-test', 557, 'received', ?)").run(new Date().toISOString());
  const leased = await fetch(`${baseUrl}/telegram/webhook`, { method:"POST", headers, body:JSON.stringify({ update_id:557 }) });
  assert.equal(leased.status, 503);
  db.prepare("UPDATE telegram_updates SET received_at=? WHERE update_id=557").run(new Date(Date.now() - 10 * 60_000).toISOString());
  const staleRetry = await fetch(`${baseUrl}/telegram/webhook`, { method:"POST", headers, body:JSON.stringify({ update_id:557 }) });
  assert.equal(staleRetry.status, 200);
});

test("health reports readiness and booking submit is rate limited", async () => {
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.clone().json()).release, "test-release");
  assert.match(health.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  delete process.env.ALLOWED_ORIGINS;
  assert.equal((await fetch(`${baseUrl}/health`)).status, 503);
  process.env.ALLOWED_ORIGINS = allowedOrigins;
  for (let index = 0; index < 5; index += 1) {
    const invalid = await fetch(`${baseUrl}/api/booking/submit`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:"{}" });
    assert.equal(invalid.status, 400);
  }
  const limited = await fetch(`${baseUrl}/api/booking/submit`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:"{}" });
  assert.equal(limited.status, 429);
});

test("production health fails closed for bot username and CRM URL", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousBotUsername = process.env.BOT_USERNAME;
  const previousCrmUrl = process.env.CRM_WEBAPP_URL;
  process.env.NODE_ENV = "production";
  delete process.env.BOT_USERNAME;
  delete process.env.CRM_WEBAPP_URL;
  try {
    const health = await fetch(`${baseUrl}/health`);
    const body = await health.json();
    assert.equal(health.status, 503);
    assert.equal(body.missing.includes("BOT_USERNAME"), true);
    assert.equal(body.missing.includes("CRM_WEBAPP_URL"), true);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousBotUsername === undefined) delete process.env.BOT_USERNAME;
    else process.env.BOT_USERNAME = previousBotUsername;
    process.env.CRM_WEBAPP_URL = previousCrmUrl;
  }
});

test("deploy readiness is fail-closed and verifies Telegram delivery access", async () => {
  const denied = await fetch(`${baseUrl}/api/ops/readiness`, { method:"POST" });
  assert.equal(denied.status, 403);
  const ready = await fetch(`${baseUrl}/api/ops/readiness`, {
    method:"POST",
    headers:{ "X-Black-Carp-Probe-Token":"test-probe-secret" }
  });
  const result = await ready.json();
  assert.equal(ready.status, 200);
  assert.deepEqual(result, { ok:true, release:"test-release", database:"ready", telegram:"ready", webhook:"ready" });
  assert.equal(telegramCalls.filter((item) => item.action === "typing").length >= 2, true);
  assert.equal(telegramCalls.some((item) => item.url === "https://black-carp.test/telegram/webhook" && item.secret_token === "test-secret" && item.drop_pending_updates === false), true);
  const wrongToken = await fetch(`${baseUrl}/api/ops/readiness`, {
    method:"POST",
    headers:{ "X-Black-Carp-Probe-Token":"wrong-probe-token" }
  });
  assert.equal(wrongToken.status, 403);
  telegramWebhookUrl = "https://wrong.example/telegram/webhook";
  const originalConsoleError = console.error;
  console.error = () => {};
  let mismatchedWebhook;
  try {
    mismatchedWebhook = await fetch(`${baseUrl}/api/ops/readiness`, {
      method:"POST",
      headers:{ "X-Black-Carp-Probe-Token":"test-probe-secret" }
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(mismatchedWebhook.status, 503);
  telegramWebhookUrl = "https://black-carp.test/telegram/webhook";
});

test("trusted proxy IPs get separate rate buckets and limiting runs before JSON parsing", async () => {
  const headers = { "Content-Type":"application/json", "X-Forwarded-For":"198.51.100.10" };
  for (let index = 0; index < 8; index += 1) {
    const response = await fetch(`${baseUrl}/api/booking/submit`, { method:"POST", headers, body:"{}" });
    assert.equal(response.status, 400);
  }
  const limitedMalformed = await fetch(`${baseUrl}/api/booking/submit`, { method:"POST", headers, body:"{" });
  assert.equal(limitedMalformed.status, 429);
  const otherProxyClient = await fetch(`${baseUrl}/api/booking/submit`, {
    method:"POST",
    headers:{ "Content-Type":"application/json", "X-Forwarded-For":"198.51.100.11" },
    body:"{"
  });
  assert.equal(otherProxyClient.status, 400);
  assert.equal((await otherProxyClient.json()).error, "invalid_json");
});

test("migration upgrades v1, backfills v3 portfolio media and rejects a newer database version", () => {
  const root = path.join(__dirname, "..");
  const v1Path = path.join(os.tmpdir(), `black-carp-v1-${process.pid}.sqlite`);
  const v3Path = path.join(os.tmpdir(), `black-carp-v3-${process.pid}.sqlite`);
  const futurePath = path.join(os.tmpdir(), `black-carp-future-${process.pid}.sqlite`);
  try {
    const v1 = new DatabaseSync(v1Path);
    v1.exec(`
      CREATE TABLE notification_outbox (
        id TEXT PRIMARY KEY, request_id TEXT NOT NULL, kind TEXT NOT NULL,
        recipient_chat_id TEXT, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT NOT NULL, last_error TEXT, sent_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      PRAGMA user_version = 1;
    `);
    v1.close();
    const upgraded = spawnSync(process.execPath, ["-e", "require('./server')"], {
      cwd:root,
      env:{ ...process.env, NODE_ENV:"test", DB_PATH:v1Path },
      encoding:"utf8"
    });
    assert.equal(upgraded.status, 0, upgraded.stderr);
    const migrated = new DatabaseSync(v1Path);
    assert.equal(migrated.prepare("PRAGMA user_version").get().user_version, 4);
    const columns = new Set(migrated.prepare("PRAGMA table_info(notification_outbox)").all().map((row) => row.name));
    assert.deepEqual(["payload_json", "claim_token", "claimed_at"].every((name) => columns.has(name)), true);
    assert.equal(Boolean(migrated.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='portfolio_items'").get()), true);
    assert.equal(Boolean(migrated.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='portfolio_media'").get()), true);
    migrated.close();

    const v3 = new DatabaseSync(v3Path);
    v3.exec(`
      CREATE TABLE portfolio_items (
        id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, caption TEXT, alt_text TEXT NOT NULL DEFAULT '', body_zone TEXT, style TEXT, year INTEGER,
        status TEXT NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0, image_path TEXT, mime_type TEXT, published_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE notification_outbox (
        id TEXT PRIMARY KEY, request_id TEXT NOT NULL, kind TEXT NOT NULL, recipient_chat_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL,
        last_error TEXT, sent_at TEXT, payload_json TEXT, claim_token TEXT, claimed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO portfolio_items (id,slug,title,alt_text,image_path,mime_type) VALUES ('legacy','legacy','Legacy','Старый кадр','uploads/portfolio/legacy.png','image/png');
      PRAGMA user_version = 3;
    `);
    v3.close();
    const v3Upgraded = spawnSync(process.execPath, ["-e", "require('./server')"], { cwd:root, env:{ ...process.env, NODE_ENV:"test", DB_PATH:v3Path }, encoding:"utf8" });
    assert.equal(v3Upgraded.status, 0, v3Upgraded.stderr);
    const backfilled = new DatabaseSync(v3Path);
    assert.equal(backfilled.prepare("PRAGMA user_version").get().user_version, 4);
    const legacyMedia = backfilled.prepare("SELECT * FROM portfolio_media WHERE portfolio_item_id='legacy'").get();
    assert.equal(legacyMedia.display_path, "uploads/portfolio/legacy.png");
    assert.equal(legacyMedia.alt_text, "Старый кадр");
    backfilled.close();

    const future = new DatabaseSync(futurePath);
    future.exec("PRAGMA user_version = 99");
    future.close();
    const rejected = spawnSync(process.execPath, ["-e", "require('./server')"], {
      cwd:root,
      env:{ ...process.env, NODE_ENV:"test", DB_PATH:futurePath },
      encoding:"utf8"
    });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /unsupported_database_version:99/);
    const unchanged = new DatabaseSync(futurePath);
    assert.equal(unchanged.prepare("PRAGMA user_version").get().user_version, 99);
    assert.equal(unchanged.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table'").get().count, 0);
    unchanged.close();
  } finally {
    for (const base of [v1Path, v3Path, futurePath]) {
      for (const file of [base, `${base}-wal`, `${base}-shm`]) fs.rmSync(file, { force:true });
    }
  }
});
