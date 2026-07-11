const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");

const dbPath = path.join("/private/tmp", `black-carp-test-${process.pid}.sqlite`);
process.env.NODE_ENV = "test";
process.env.DB_PATH = dbPath;
process.env.MASTER_TELEGRAM_IDS = "100";
process.env.MASTER_CHAT_IDS = "100,200";
process.env.BOT_TOKEN = "test-token";
process.env.WEBHOOK_SECRET = "test-secret";
process.env.CRM_WEBAPP_URL = "https://black-carp.test/crm";
process.env.SITE_URL = "https://black-carp.test";
process.env.ALLOWED_ORIGINS = "https://black-carp.test";

const { app, db } = require("../server");
let server;
let telegramServer;
let baseUrl;
const telegramCalls = [];
const telegramAttempts = new Map();
let failAllTelegram = false;

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
      res.writeHead(shouldFail ? 500 : 200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(shouldFail ? { ok:false, description:"temporary" } : { ok:true, result:{ message_id:telegramCalls.length } }));
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
