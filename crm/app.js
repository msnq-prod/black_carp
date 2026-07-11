(() => {
  const tg = window.Telegram?.WebApp;
  const params = new URLSearchParams(location.search);
  const devMasterId = params.get("devMasterId");
  const requestedCode = params.get("request");
  const statusLabels = {
    "": "Все", new: "Новые", in_review: "В работе", need_details: "Уточнить",
    approved: "Согласовано", scheduled: "Запланировано", done: "Готово", cancelled: "Отменено"
  };
  const transitions = {
    new: ["in_review", "need_details", "approved", "scheduled", "cancelled"],
    in_review: ["need_details", "approved", "scheduled", "cancelled"],
    need_details: ["in_review", "approved", "cancelled"],
    approved: ["scheduled", "cancelled"], scheduled: ["done", "cancelled"], done: [], cancelled: []
  };
  const eventLabels = {
    request_created: "Заявка создана", master_notified: "Мастер уведомлён",
    master_notify_failed: "Ошибка уведомления", request_opened: "Карточка открыта",
    status_changed: "Статус изменён", note_added: "Добавлена заметка",
    schedule_changed: "Изменено планирование", telegram_linked: "Telegram клиента связан",
    client_message: "Сообщение клиента"
  };
  const state = { status: "", q: "", cursor: null, items: [], counts: {}, selectedId: null, selected: null, loading: false, pendingReload: false };
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
  const authHeaders = () => ({
    "X-Telegram-Init-Data": tg?.initData || "",
    ...(devMasterId ? { "X-Test-Master-Id": devMasterId } : {})
  });

  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, headers: { "Content-Type":"application/json", ...authHeaders(), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || "request_failed"); error.status = response.status; throw error; }
    return data;
  }

  function formatDate(value) {
    return value ? new Intl.DateTimeFormat("ru-RU", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }).format(new Date(value)) : "—";
  }

  function toLocalInput(value) {
    if (!value) return "";
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  function setSync(text, isError = false) {
    const node = $("#syncStatus");
    node.textContent = text;
    node.classList.toggle("error", isError);
  }

  function renderFilters() {
    $("#filters").innerHTML = Object.entries(statusLabels).map(([key, label]) =>
      `<button class="filter" data-status="${key}" aria-pressed="${state.status === key}">${label}</button>`).join("");
  }

  function renderCounters() {
    const groups = [["new", "Новые"], ["in_review", "В работе"], ["scheduled", "Запланировано"]];
    $("#counters").innerHTML = groups.map(([key, label]) =>
      `<div class="counter"><b>${Number(state.counts[key] || 0)}</b><small>${label}</small></div>`).join("");
  }

  function renderRows() {
    const root = $("#requestRows");
    if (!state.items.length && !state.loading) {
      root.innerHTML = '<p class="list-empty">Заявок по этому фильтру нет.</p>';
    } else {
      root.innerHTML = state.items.map((item) => {
        const size = item.sizeCm ? ` · ${item.sizeCm} см` : "";
        const attachment = item.hasAttachments ? " · есть файлы" : "";
        return `<button class="request-row ${item.id === state.selectedId ? "is-active" : ""}" data-id="${escapeHtml(item.id)}" data-status="${escapeHtml(item.status)}" type="button"><span class="request-row__status"></span><span class="request-row__main"><strong>${escapeHtml(item.clientName)}</strong><small>${escapeHtml(item.publicCode)} · ${escapeHtml(statusLabels[item.status] || item.status)} · ${escapeHtml(item.bodySubzone || item.bodyZone)}${escapeHtml(size)}${escapeHtml(attachment)}</small><small>${escapeHtml(item.contactValue)}</small></span><time>${formatDate(item.createdAt)}</time></button>`;
      }).join("");
    }
    $("#loadMore").hidden = !state.cursor;
  }

  function contactHref(detail) {
    if (detail.contactType === "phone") return `tel:${detail.contactValue}`;
    if (detail.contactType === "telegram") return `https://t.me/${detail.contactValue.replace(/^@/, "")}`;
    return null;
  }

  function statusOptions(detail) {
    const allowed = new Set([detail.status, ...(transitions[detail.status] || [])]);
    return Object.entries(statusLabels).filter(([key]) => key && allowed.has(key)).map(([key, label]) =>
      `<option value="${key}" ${key === detail.status ? "selected" : ""}>${label}</option>`).join("");
  }

  function summaryText(detail) {
    return [`Заявка ${detail.publicCode}`, `Клиент: ${detail.clientName}`, `Контакт: ${detail.contactValue || "—"}`, `Зона: ${detail.bodyZone} / ${detail.bodySubzone}`, `Размер: ${detail.sizeCm ? `${detail.sizeCm} см` : "—"}`, `Идея: ${detail.ideaText || "—"}`].join("\n");
  }

  function renderDetail(detail) {
    const contact = contactHref(detail);
    const canSchedule = detail.status === "scheduled" || (transitions[detail.status] || []).includes("scheduled");
    const timeline = detail.activity.slice(0, 12).map((event) => `<li>${escapeHtml(eventLabels[event.eventType] || event.eventType)}<time>${formatDate(event.createdAt)}</time></li>`).join("") || "<li>Нет событий</li>";
    const attachments = detail.attachments.map((item, index) => `<a class="attachment" data-attachment-url="${escapeHtml(item.url)}" href="#" target="_blank" rel="noreferrer"><span>${item.kind === "sketch" ? "Эскиз" : "Референс"} ${index + 1}</span><small>загрузка…</small></a>`).join("") || "Нет вложений";
    $("#requestDetail").innerHTML = `
      <button class="mobile-back" id="mobileBack" type="button">К списку</button>
      <div class="detail-head"><div><p class="eyebrow">${escapeHtml(detail.publicCode)} · ${formatDate(detail.createdAt)}</p><h2>${escapeHtml(detail.clientName)}</h2></div><label class="status-control">Статус<select class="status-select" id="statusSelect">${statusOptions(detail)}</select></label></div>
      <div class="contact-actions">${contact ? `<a href="${escapeHtml(contact)}" target="_blank" rel="noreferrer">Связаться: ${escapeHtml(detail.contactValue)}</a>` : ""}<button type="button" id="copyContact">Скопировать контакт</button><button type="button" id="copySummary">Скопировать резюме</button><a href="#notes">Добавить заметку</a></div>
      <div class="detail-grid">
        <section class="detail-section"><h3>АНКЕТА</h3><dl class="data-list"><dt>Зона</dt><dd>${escapeHtml(detail.bodyZone)} / ${escapeHtml(detail.bodySubzone)}</dd><dt>Размер</dt><dd>${detail.sizeCm ? `${detail.sizeCm} см` : "не указан"}</dd><dt>Эскиз</dt><dd>${detail.hasSketch ? "Есть" : "Нужна разработка"}</dd><dt>Оценка</dt><dd>${escapeHtml(detail.priceEstimate)}</dd></dl></section>
        <section class="detail-section"><h3>КОНТАКТ</h3><dl class="data-list"><dt>Канал</dt><dd>${escapeHtml(detail.contactType || "—")}</dd><dt>Контакт</dt><dd>${escapeHtml(detail.contactValue || "—")}</dd><dt>Комментарий</dt><dd>${escapeHtml(detail.contactComment || "—")}</dd></dl></section>
        <section class="detail-section"><h3>ИДЕЯ</h3><p class="idea">${escapeHtml(detail.ideaText || "Клиент не оставил описание.")}</p></section>
        <section class="detail-section"><h3>ВЛОЖЕНИЯ</h3><div class="attachments">${attachments}</div></section>
        <section class="detail-section"><h3>ПЛАНИРОВАНИЕ</h3>${canSchedule ? `<form class="schedule-form" id="scheduleForm"><label>Дата и время<input type="datetime-local" name="scheduledAt" value="${toLocalInput(detail.scheduledAt)}" required></label><label>Длительность, минут<input type="number" name="durationMinutes" min="15" max="1440" value="${detail.durationMinutes || 120}" required></label><label>Комментарий<textarea name="comment" placeholder="Комментарий к сеансу">${escapeHtml(detail.scheduleComment || "")}</textarea></label><button>Сохранить дату</button></form>` : `<p class="muted">Планирование недоступно в этом статусе.</p>`}</section>
        <section class="detail-section" id="notes"><h3>ЗАМЕТКИ</h3><form class="note-form" id="noteForm"><label>Новая заметка<textarea name="text" rows="3" maxlength="2000" placeholder="Внутренняя заметка"></textarea></label><button>Добавить</button></form><ul class="notes">${detail.notes.map((note) => `<li>${escapeHtml(note.text)}<time>${formatDate(note.createdAt)}</time></li>`).join("")}</ul></section>
        <section class="detail-section"><h3>ИСТОРИЯ</h3><ul class="timeline">${timeline}</ul></section>
      </div>`;
    bindDetail(detail);
    hydrateAttachments();
  }

  function bindDetail(detail) {
    $("#mobileBack").addEventListener("click", () => {
      $(".request-list").scrollIntoView({ behavior:"smooth", block:"start" });
      $("#searchInput").focus({ preventScroll:true });
    });
    $("#copyContact").addEventListener("click", () => copyText(detail.contactValue || "", "Контакт скопирован"));
    $("#copySummary").addEventListener("click", () => copyText(summaryText(detail), "Резюме скопировано"));
    $("#statusSelect").addEventListener("change", async (event) => {
      const nextStatus = event.target.value;
      if (["done", "cancelled"].includes(nextStatus) && !(await confirmTerminalStatus(nextStatus))) {
        event.target.value = detail.status;
        return;
      }
      update(`/api/crm/requests/${detail.id}/status`, { status:nextStatus });
    });
    $("#noteForm").addEventListener("submit", (event) => { event.preventDefault(); const text = new FormData(event.currentTarget).get("text"); if (text) update(`/api/crm/requests/${detail.id}/notes`, { text }, "POST"); });
    $("#scheduleForm")?.addEventListener("submit", (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); update(`/api/crm/requests/${detail.id}/schedule`, { scheduledAt:new Date(form.get("scheduledAt")).toISOString(), durationMinutes:Number(form.get("durationMinutes")), comment:form.get("comment") }); });
  }

  async function hydrateAttachments() {
    for (const link of document.querySelectorAll("[data-attachment-url]")) {
      try {
        const response = await fetch(link.dataset.attachmentUrl, { headers:authHeaders() });
        if (!response.ok) throw new Error("attachment_failed");
        const blob = await response.blob();
        link.href = URL.createObjectURL(blob);
        link.querySelector("small").textContent = `${Math.max(1, Math.round(blob.size / 1024))} КБ`;
      } catch {
        link.removeAttribute("target");
        link.querySelector("small").textContent = "ошибка";
        link.classList.add("error");
      }
    }
  }

  async function copyText(value, message) {
    try { await navigator.clipboard.writeText(value); setSync(message); } catch { setSync("Не удалось скопировать", true); }
  }

  function confirmTerminalStatus(status) {
    const dialog = $("#statusConfirm");
    $("#statusConfirmTitle").textContent = status === "done" ? "Завершить заявку?" : "Отменить заявку?";
    $("#statusConfirmText").textContent = "Статус станет финальным. Вернуть заявку в работу через CRM будет нельзя.";
    dialog.returnValue = "cancel";
    dialog.showModal();
    return new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once:true }));
  }

  async function update(path, body, method = "PATCH") {
    setSync("Сохраняем…");
    document.body.classList.add("is-saving");
    try {
      const result = await api(path, { method, body:JSON.stringify(body) });
      const fresh = result.request || (await api(`/api/crm/requests/${state.selectedId}`)).request;
      state.selected = fresh;
      state.selectedId = fresh.id;
      renderDetail(fresh);
      await load(false);
      setSync("Сохранено");
    } catch (error) {
      if (state.selected) renderDetail(state.selected);
      setSync(`Не удалось сохранить: ${error.message}`, true);
    } finally {
      document.body.classList.remove("is-saving");
    }
  }

  async function select(idOrCode) {
    try {
      const result = await api(`/api/crm/requests/${encodeURIComponent(idOrCode)}`);
      state.selectedId = result.request.id;
      state.selected = result.request;
      renderRows();
      renderDetail(result.request);
      if (matchMedia("(max-width: 760px)").matches) {
        $("#requestDetail").focus({ preventScroll:true });
        $("#requestDetail").scrollIntoView({ behavior:"smooth", block:"start" });
      }
    } catch (error) {
      $("#requestDetail").innerHTML = `<p class="error">Не удалось открыть заявку: ${escapeHtml(error.message)}</p>`;
    }
  }

  async function load(append = false) {
    if (state.loading) {
      state.pendingReload = true;
      return;
    }
    state.loading = true;
    if (!append) $("#requestRows").innerHTML = '<p class="list-empty">Загружаем заявки…</p>';
    try {
      const query = new URLSearchParams();
      if (state.status) query.set("status", state.status);
      if (state.q) query.set("q", state.q);
      if (append && state.cursor) query.set("cursor", state.cursor);
      const result = await api(`/api/crm/requests?${query}`);
      state.items = append ? [...state.items, ...result.items] : result.items;
      state.counts = result.counts || {};
      state.cursor = result.nextCursor;
      state.loading = false;
      renderCounters();
      renderRows();
    } catch (error) {
      state.loading = false;
      $("#requestRows").innerHTML = `<p class="error">Не удалось загрузить заявки: ${escapeHtml(error.message)}</p>`;
    } finally {
      state.loading = false;
      if (state.pendingReload) {
        state.pendingReload = false;
        load(false);
      }
    }
  }

  async function boot() {
    tg?.ready(); tg?.expand();
    try {
      await api("/api/crm/me");
      $("#workspace").hidden = false;
      renderFilters();
      await load();
      if (requestedCode) await select(requestedCode);
    } catch (error) {
      if ([401, 403].includes(error.status)) $("#authState").hidden = false;
      else { $("#workspace").hidden = false; $("#requestRows").innerHTML = `<p class="error">CRM временно недоступна: ${escapeHtml(error.message)}</p>`; }
    }
  }

  $("#filters").addEventListener("click", (event) => { const button = event.target.closest("[data-status]"); if (!button) return; state.status = button.dataset.status; state.cursor = null; renderFilters(); load(); });
  $("#requestRows").addEventListener("click", (event) => { const row = event.target.closest("[data-id]"); if (row) select(row.dataset.id); });
  let searchTimer;
  $("#searchInput").addEventListener("input", (event) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.q = event.target.value.trim(); state.cursor = null; load(); }, 250); });
  $("#loadMore").addEventListener("click", () => load(true));
  $("#refreshButton").addEventListener("click", () => load());
  boot();
})();
