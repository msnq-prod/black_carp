(() => {
  const tg = window.Telegram?.WebApp;
  const params = new URLSearchParams(location.search);
  const devMasterId = params.get("devMasterId");
  const requestedCode = params.get("request");
  const mobileViewport = window.matchMedia("(max-width: 760px)");
  const telegramBackButtonSupported = Boolean(tg?.isVersionAtLeast?.("6.1"));
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
  const state = { status: "", q: "", cursor: null, items: [], counts: {}, selectedId: null, selected: null, loading: false, pendingReload: false, selectionVersion: 0, saving: false };
  const requestTimeoutMs = 15_000;
  const attachmentObjectUrls = new Set();
  let attachmentHydrationVersion = 0;
  let listScrollPosition = 0;
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
  const authHeaders = () => ({
    "X-Telegram-Init-Data": tg?.initData || "",
    ...(devMasterId ? { "X-Test-Master-Id": devMasterId } : {})
  });

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      return await fetch(path, { ...options, signal:controller.signal, headers: { ...authHeaders(), ...(options.headers || {}) } });
    } catch (error) {
      const wrapped = new Error(error?.name === "AbortError" ? "network_timeout" : "network_error");
      wrapped.cause = error;
      throw wrapped;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function api(path, options = {}) {
    const response = await request(path, { ...options, headers: { "Content-Type":"application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || "request_failed"); error.status = response.status; throw error; }
    return data;
  }

  function humanError(error) {
    const messages = {
      network_timeout: "Сервер отвечает слишком долго. Проверьте связь и повторите.",
      network_error: "Нет связи с CRM. Проверьте интернет и повторите.",
      not_found: "Заявка не найдена или уже удалена.",
      invalid_transition: "Статус заявки уже изменился. Обновите карточку.",
      invalid_schedule: "Проверьте дату, время и длительность.",
      note_required: "Введите текст заметки.",
      forbidden: "У этого Telegram-профиля нет доступа.",
      invalid_init_data: "Сессия Telegram устарела. Откройте CRM из бота заново."
    };
    return messages[error?.message] || (error?.status >= 500 ? "CRM временно недоступна. Повторите позже." : "Не удалось выполнить действие. Повторите.");
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

  function renderListError(error, retryAction = "load") {
    $("#requestRows").innerHTML = `<div class="state-error" role="alert"><p>${escapeHtml(humanError(error))}</p><button type="button" data-retry-action="${retryAction}">Повторить</button></div>`;
    $("#loadMore").hidden = true;
  }

  function releaseAttachmentUrls() {
    for (const url of attachmentObjectUrls) URL.revokeObjectURL(url);
    attachmentObjectUrls.clear();
  }

  function renderFilters() {
    const root = $("#filters");
    const focusedStatus = document.activeElement?.closest?.("[data-status]")?.dataset.status;
    root.innerHTML = Object.entries(statusLabels).map(([key, label]) =>
      `<button class="filter" data-status="${key}" aria-pressed="${state.status === key}">${label}</button>`).join("");
    if (focusedStatus !== undefined) {
      [...root.querySelectorAll("[data-status]")].find((button) => button.dataset.status === focusedStatus)?.focus({ preventScroll:true });
    }
  }

  function renderCounters() {
    const groups = [["new", "Новые"], ["in_review", "В работе"], ["scheduled", "Запланировано"]];
    $("#counters").innerHTML = groups.map(([key, label]) =>
      `<div class="counter"><b>${Number(state.counts[key] || 0)}</b><small>${label}</small></div>`).join("");
  }

  function renderRows() {
    const root = $("#requestRows");
    const focusedRequestId = document.activeElement?.closest?.("[data-id]")?.dataset.id;
    if (!state.items.length && !state.loading) {
      root.innerHTML = '<p class="list-empty">Заявок по этому фильтру нет.</p>';
    } else {
      root.innerHTML = state.items.map((item) => {
        const size = item.sizeCm ? ` · ${item.sizeCm} см` : "";
        const attachment = item.hasAttachments ? " · есть файлы" : "";
        return `<button class="request-row ${item.id === state.selectedId ? "is-active" : ""}" data-id="${escapeHtml(item.id)}" data-status="${escapeHtml(item.status)}" type="button" aria-current="${item.id === state.selectedId ? "true" : "false"}"><span class="request-row__status"></span><span class="request-row__main"><strong>${escapeHtml(item.clientName)}</strong><small>${escapeHtml(item.publicCode)} · ${escapeHtml(statusLabels[item.status] || item.status)} · ${escapeHtml(item.bodySubzone || item.bodyZone)}${escapeHtml(size)}${escapeHtml(attachment)}</small><small>${escapeHtml(item.contactValue)}</small></span><time>${formatDate(item.createdAt)}</time></button>`;
      }).join("");
    }
    $("#loadMore").hidden = !state.cursor;
    $("#loadMore").disabled = state.loading;
    if (focusedRequestId) {
      [...root.querySelectorAll("[data-id]")].find((button) => button.dataset.id === focusedRequestId)?.focus({ preventScroll:true });
    }
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
    releaseAttachmentUrls();
    const hydrationVersion = ++attachmentHydrationVersion;
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
    if (state.saving) setDetailControlsDisabled(true);
    hydrateAttachments(hydrationVersion);
  }

  function updateRequestUrl(requestCode, mode = "push") {
    if (mode === "none") return;
    const url = new URL(location.href);
    if (requestCode) url.searchParams.set("request", requestCode);
    else url.searchParams.delete("request");
    history[mode === "replace" ? "replaceState" : "pushState"]({ request:requestCode || null }, "", url);
  }

  function enterDetailView(detail, historyMode = "push") {
    document.body.classList.add("detail-open");
    updateRequestUrl(detail.publicCode, historyMode);
    if (mobileViewport.matches) {
      if (telegramBackButtonSupported) tg.BackButton.show();
      window.scrollTo({ top:0, behavior:"auto" });
    }
  }

  function leaveDetailView(historyMode = "push") {
    if (state.saving) {
      setSync("Дождитесь завершения сохранения", true);
      return;
    }
    const previousId = state.selectedId;
    state.selectionVersion += 1;
    state.selectedId = null;
    state.selected = null;
    releaseAttachmentUrls();
    attachmentHydrationVersion += 1;
    document.body.classList.remove("detail-open");
    $("#requestDetail").innerHTML = '<div class="empty-detail"><p class="eyebrow">BLACK CARP CRM</p><h2>Выберите<br>заявку.</h2></div>';
    updateRequestUrl(null, historyMode);
    if (telegramBackButtonSupported) tg.BackButton.hide();
    renderRows();
    requestAnimationFrame(() => {
      if (mobileViewport.matches) window.scrollTo({ top:listScrollPosition, behavior:"auto" });
      if (previousId) document.querySelector(`[data-id="${CSS.escape(previousId)}"]`)?.focus({ preventScroll:true });
    });
  }

  function setDetailControlsDisabled(disabled) {
    $("#requestDetail").querySelectorAll("button,input,select,textarea").forEach((control) => {
      if (disabled) {
        control.dataset.savingDisabled = String(control.disabled);
        control.disabled = true;
      } else if (control.dataset.savingDisabled !== undefined) {
        control.disabled = control.dataset.savingDisabled === "true";
        delete control.dataset.savingDisabled;
      }
    });
  }

  function captureDetailFocus() {
    const active = document.activeElement;
    if (!active || !$("#requestDetail").contains(active)) return null;
    const formId = active.closest("form")?.id || "";
    if (active.id) return { id:active.id };
    if (active.getAttribute("name")) return { formId, name:active.getAttribute("name") };
    if (active.tagName === "BUTTON" && formId) return { formId, button:true };
    return { detail:true };
  }

  function restoreDetailFocus(snapshot) {
    if (!snapshot) return;
    let target = null;
    if (snapshot.id) target = document.getElementById(snapshot.id);
    else if (snapshot.formId && snapshot.name) target = document.querySelector(`#${snapshot.formId} [name="${snapshot.name}"]`);
    else if (snapshot.formId && snapshot.button) target = document.querySelector(`#${snapshot.formId} button`);
    (target || $("#requestDetail")).focus({ preventScroll:true });
  }

  function bindDetail(detail) {
    $("#mobileBack").addEventListener("click", () => leaveDetailView());
    $("#copyContact").addEventListener("click", () => copyText(detail.contactValue || "", "Контакт скопирован"));
    $("#copySummary").addEventListener("click", () => copyText(summaryText(detail), "Резюме скопировано"));
    $("#statusSelect").addEventListener("change", async (event) => {
      if (state.saving) { event.target.value = detail.status; return; }
      const nextStatus = event.target.value;
      if (["done", "cancelled"].includes(nextStatus) && !(await confirmTerminalStatus(nextStatus))) {
        event.target.value = detail.status;
        return;
      }
      const saved = await update(`/api/crm/requests/${detail.id}/status`, { status:nextStatus });
      if (!saved && state.selectedId === detail.id && event.target.isConnected) event.target.value = detail.status;
    });
    $("#noteForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = String(new FormData(event.currentTarget).get("text") || "").trim();
      if (!text) { event.currentTarget.elements.text.focus(); setSync("Введите текст заметки", true); return; }
      await update(`/api/crm/requests/${detail.id}/notes`, { text }, "POST");
    });
    $("#scheduleForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await update(`/api/crm/requests/${detail.id}/schedule`, { scheduledAt:new Date(form.get("scheduledAt")).toISOString(), durationMinutes:Number(form.get("durationMinutes")), comment:form.get("comment") });
    });
  }

  async function hydrateAttachments(version) {
    const links = [...document.querySelectorAll("[data-attachment-url]")];
    await Promise.all(links.map(async (link) => {
      try {
        const response = await request(link.dataset.attachmentUrl);
        if (!response.ok) throw new Error("attachment_failed");
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        if (version !== attachmentHydrationVersion || !link.isConnected) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        attachmentObjectUrls.add(objectUrl);
        link.href = objectUrl;
        link.querySelector("small").textContent = `${Math.max(1, Math.round(blob.size / 1024))} КБ`;
      } catch {
        if (version !== attachmentHydrationVersion || !link.isConnected) return;
        link.removeAttribute("target");
        link.querySelector("small").textContent = "ошибка";
        link.classList.add("error");
      }
    }));
  }

  async function copyText(value, message) {
    try { await navigator.clipboard.writeText(value); setSync(message); } catch { setSync("Не удалось скопировать", true); }
  }

  function confirmTerminalStatus(status) {
    const dialog = $("#statusConfirm");
    const returnFocus = document.activeElement;
    $("#statusConfirmTitle").textContent = status === "done" ? "Завершить заявку?" : "Отменить заявку?";
    $("#statusConfirmText").textContent = "Статус станет финальным. Вернуть заявку в работу через CRM будет нельзя.";
    dialog.returnValue = "cancel";
    dialog.showModal();
    requestAnimationFrame(() => dialog.querySelector('[value="cancel"]')?.focus());
    return new Promise((resolve) => dialog.addEventListener("close", () => {
      returnFocus?.focus?.({ preventScroll:true });
      resolve(dialog.returnValue === "confirm");
    }, { once:true }));
  }

  async function update(path, body, method = "PATCH") {
    if (state.saving) { setSync("Дождитесь завершения сохранения", true); return false; }
    const targetId = state.selectedId;
    const selectionVersion = state.selectionVersion;
    const focusSnapshot = captureDetailFocus();
    state.saving = true;
    setSync("Сохраняем…");
    document.body.classList.add("is-saving");
    $("#refreshButton").disabled = true;
    $("#requestDetail").setAttribute("aria-busy", "true");
    setDetailControlsDisabled(true);
    try {
      const result = await api(path, { method, body:JSON.stringify(body) });
      const fresh = result.request || (await api(`/api/crm/requests/${targetId}`)).request;
      if (state.selectionVersion === selectionVersion && state.selectedId === targetId) {
        state.selected = fresh;
        state.selectedId = fresh.id;
        renderDetail(fresh);
      }
      await load(false);
      setSync("Сохранено");
      return true;
    } catch (error) {
      setSync(humanError(error), true);
      return false;
    } finally {
      state.saving = false;
      document.body.classList.remove("is-saving");
      $("#refreshButton").disabled = false;
      setDetailControlsDisabled(false);
      if (state.selectionVersion === selectionVersion) {
        $("#requestDetail").removeAttribute("aria-busy");
        restoreDetailFocus(focusSnapshot);
      }
    }
  }

  function renderDetailError(error, idOrCode) {
    releaseAttachmentUrls();
    attachmentHydrationVersion += 1;
    $("#requestDetail").innerHTML = `<button class="mobile-back" id="mobileBack" type="button">К списку</button><div class="state-error" role="alert"><p>${escapeHtml(humanError(error))}</p><button type="button" data-retry-request="${escapeHtml(idOrCode)}">Повторить</button></div>`;
    document.body.classList.add("detail-open");
    $("#mobileBack").addEventListener("click", () => leaveDetailView());
    $("[data-retry-request]").addEventListener("click", () => select(idOrCode));
  }

  async function select(idOrCode, { historyMode = "push" } = {}) {
    if (state.saving) {
      setSync("Дождитесь завершения сохранения", true);
      return;
    }
    const selectionVersion = ++state.selectionVersion;
    if (mobileViewport.matches && !document.body.classList.contains("detail-open")) listScrollPosition = window.scrollY;
    setSync("Открываем заявку…");
    $("#requestDetail").setAttribute("aria-busy", "true");
    try {
      const result = await api(`/api/crm/requests/${encodeURIComponent(idOrCode)}`);
      if (selectionVersion !== state.selectionVersion) return;
      state.selectedId = result.request.id;
      state.selected = result.request;
      renderRows();
      renderDetail(result.request);
      enterDetailView(result.request, historyMode);
      $("#requestDetail").focus({ preventScroll:true });
      setSync("");
    } catch (error) {
      if (selectionVersion !== state.selectionVersion) return;
      state.selectedId = null;
      state.selected = null;
      renderRows();
      renderDetailError(error, idOrCode);
      updateRequestUrl(idOrCode, historyMode);
      setSync(humanError(error), true);
      $("#requestDetail").focus({ preventScroll:true });
    } finally {
      if (selectionVersion === state.selectionVersion) $("#requestDetail").removeAttribute("aria-busy");
    }
  }

  async function load(append = false) {
    if (state.loading) {
      if (!append) state.pendingReload = true;
      return;
    }
    state.loading = true;
    $("#requestRows").setAttribute("aria-busy", "true");
    $("#loadMore").disabled = true;
    if (!append) {
      $("#requestRows").innerHTML = '<p class="list-empty" role="status">Загружаем заявки…</p>';
      $("#loadMore").hidden = true;
    }
    const requestedStatus = state.status;
    const requestedQuery = state.q;
    try {
      const query = new URLSearchParams();
      if (requestedStatus) query.set("status", requestedStatus);
      if (requestedQuery) query.set("q", requestedQuery);
      if (append && state.cursor) query.set("cursor", state.cursor);
      const result = await api(`/api/crm/requests?${query}`);
      if (state.pendingReload || requestedStatus !== state.status || requestedQuery !== state.q) return;
      state.items = append ? [...state.items, ...result.items] : result.items;
      state.counts = result.counts || {};
      state.cursor = result.nextCursor;
      state.loading = false;
      renderCounters();
      renderRows();
    } catch (error) {
      if (!state.pendingReload) {
        state.cursor = null;
        renderListError(error);
      }
    } finally {
      state.loading = false;
      $("#requestRows").removeAttribute("aria-busy");
      if (state.pendingReload) {
        state.pendingReload = false;
        load(false);
      } else {
        $("#loadMore").disabled = false;
      }
    }
  }

  async function boot() {
    tg?.ready(); tg?.expand();
    $("#authState").hidden = true;
    try {
      await api("/api/crm/me");
      $("#workspace").hidden = false;
      renderFilters();
      await load();
      if (requestedCode) await select(requestedCode, { historyMode:"replace" });
    } catch (error) {
      if ([401, 403].includes(error.status)) {
        $("#workspace").hidden = true;
        $("#authState").hidden = false;
      }
      else {
        $("#workspace").hidden = false;
        renderFilters();
        renderCounters();
        renderListError(error, "boot");
      }
    }
  }

  async function refreshWorkspace() {
    if (state.saving) {
      setSync("Дождитесь завершения сохранения", true);
      return;
    }
    if ($("#workspace").hidden) {
      await boot();
      return;
    }
    const selectedId = state.selectedId;
    await load(false);
    if (selectedId) await select(selectedId, { historyMode:"none" });
  }

  $("#filters").addEventListener("click", (event) => { const button = event.target.closest("[data-status]"); if (!button) return; state.status = button.dataset.status; state.cursor = null; renderFilters(); load(); });
  $("#requestRows").addEventListener("click", (event) => {
    if (state.saving) { setSync("Дождитесь завершения сохранения", true); return; }
    const retry = event.target.closest("[data-retry-action]");
    if (retry) { retry.dataset.retryAction === "boot" ? boot() : load(false); return; }
    const row = event.target.closest("[data-id]");
    if (row) select(row.dataset.id);
  });
  let searchTimer;
  $("#searchInput").addEventListener("input", (event) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.q = event.target.value.trim(); state.cursor = null; load(); }, 250); });
  $("#loadMore").addEventListener("click", () => { if (!state.loading) load(true); });
  $("#refreshButton").addEventListener("click", refreshWorkspace);
  if (telegramBackButtonSupported) tg.BackButton.onClick(() => leaveDetailView());
  window.addEventListener("popstate", () => {
    const requestCode = new URLSearchParams(location.search).get("request");
    if (requestCode) select(requestCode, { historyMode:"none" });
    else leaveDetailView("none");
  });
  window.addEventListener("pagehide", releaseAttachmentUrls);
  boot();
})();
