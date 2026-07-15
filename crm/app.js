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
  const portfolio = { status:"", q:"", items:[], counts:{}, current:null, imageDataUrl:null, loading:false, dirty:false };
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
      title_required: "Укажите название работы.",
      invalid_year: "Проверьте год работы.",
      invalid_portfolio_image: "Выберите корректное JPG, PNG или WebP до 8 МБ.",
      item_incomplete: "Для публикации нужны изображение, название и alt-текст.",
      archived_item: "Архивную работу нельзя редактировать.",
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

  function updateSectionUrl(section, itemId = null, mode = "push") {
    if (mode === "none") return;
    const url = new URL(location.href);
    if (section === "portfolio") url.searchParams.set("section", "portfolio");
    else url.searchParams.delete("section");
    if (itemId) url.searchParams.set("item", itemId);
    else url.searchParams.delete("item");
    if (section !== "requests") url.searchParams.delete("request");
    history[mode === "replace" ? "replaceState" : "pushState"]({ section, item:itemId }, "", url);
  }

  function setActiveNav(section) {
    document.querySelectorAll("[data-section]").forEach((button) => button.classList.toggle("is-active", button.dataset.section === section));
  }

  async function showSection(section, { historyMode = "push", itemId = null } = {}) {
    if (section === "portfolio") {
      document.body.classList.remove("detail-open", "portfolio-edit");
      document.body.classList.add("section-portfolio");
      $("#portfolioSection").hidden = false;
      $("#portfolioEditor").hidden = true;
      setActiveNav("portfolio");
      if (telegramBackButtonSupported) tg.BackButton.hide();
      updateSectionUrl("portfolio", null, itemId ? "none" : historyMode);
      if (!portfolio.items.length) await loadPortfolio();
      if (itemId) await openPortfolioEditor(itemId, historyMode);
      return;
    }
    document.body.classList.remove("section-portfolio", "portfolio-edit");
    $("#portfolioSection").hidden = true;
    $("#portfolioEditor").hidden = true;
    setActiveNav("requests");
    updateSectionUrl("requests", null, historyMode);
  }

  function renderPortfolio() {
    const published = Number(portfolio.counts.published || 0);
    const drafts = Number(portfolio.counts.draft || 0);
    $("#portfolioSummary").innerHTML = `<span><b>${published}</b> опубликовано</span><span><b>${drafts}</b> черновиков</span>`;
    document.querySelectorAll("[data-portfolio-status]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.portfolioStatus === portfolio.status)));
    const root = $("#portfolioGrid");
    if (!portfolio.items.length) {
      root.innerHTML = '<p class="list-empty">Работ по этому фильтру нет.</p>';
      return;
    }
    const canReorder = !portfolio.status && !portfolio.q;
    root.innerHTML = portfolio.items.map((item, index) => {
      const badge = item.status === "published" ? "В ЭФИРЕ" : item.status === "draft" ? "ЧЕРНОВИК" : "АРХИВ";
      const badgeClass = item.status === "draft" ? "work-badge--draft" : item.status === "archived" ? "work-badge--archived" : "";
      const meta = [item.bodyZone, item.style, item.year].filter(Boolean).join(" · ") || "Без описания";
      return `<article class="work-card" data-portfolio-id="${escapeHtml(item.id)}"><button class="work-card__open" type="button" data-open-portfolio="${escapeHtml(item.id)}"><div class="work-card__media">${item.imageUrl ? `<img data-portfolio-image="${escapeHtml(item.imageUrl)}" alt="">` : ""}<span class="work-badge ${badgeClass}">${badge}</span></div><div class="work-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(meta)}</small></div></button>${canReorder && item.status !== "archived" ? `<div class="work-order"><button type="button" data-move-portfolio="-1" aria-label="Поднять" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-move-portfolio="1" aria-label="Опустить" ${index === portfolio.items.filter((row) => row.status !== "archived").length - 1 ? "disabled" : ""}>↓</button></div>` : ""}</article>`;
    }).join("");
    hydratePortfolioImages(root);
  }

  async function hydratePortfolioImages(root) {
    for (const image of root.querySelectorAll("[data-portfolio-image]")) {
      try {
        const response = await request(image.dataset.portfolioImage);
        if (!response.ok) throw new Error("image_failed");
        const url = URL.createObjectURL(await response.blob());
        attachmentObjectUrls.add(url);
        image.src = url;
      } catch { image.remove(); }
    }
  }

  async function loadPortfolio() {
    if (portfolio.loading) return;
    portfolio.loading = true;
    $("#portfolioError").hidden = true;
    try {
      const query = new URLSearchParams();
      if (portfolio.status) query.set("status", portfolio.status);
      if (portfolio.q) query.set("q", portfolio.q);
      const result = await api(`/api/crm/portfolio?${query}`);
      portfolio.items = result.items;
      portfolio.counts = result.counts || {};
      renderPortfolio();
    } catch (error) {
      $("#portfolioError").hidden = false;
      $("#portfolioError").textContent = humanError(error);
    } finally { portfolio.loading = false; }
  }

  function clearPortfolioForm() {
    portfolio.current = null;
    portfolio.imageDataUrl = null;
    portfolio.dirty = false;
    $("#portfolioForm").reset();
    $("#portfolioPreview").innerHTML = "<span>Добавьте изображение</span>";
    $("#archivePortfolioButton").hidden = true;
    $("#publishPortfolioButton").textContent = "Опубликовать";
    $("#portfolioFeedback").textContent = "";
  }

  async function showPortfolioImage(item) {
    if (!item?.imageUrl) { $("#portfolioPreview").innerHTML = "<span>Добавьте изображение</span>"; return; }
    try {
      const response = await request(item.imageUrl);
      if (!response.ok) throw new Error("image_failed");
      const url = URL.createObjectURL(await response.blob());
      attachmentObjectUrls.add(url);
      $("#portfolioPreview").innerHTML = `<img src="${url}" alt="">`;
    } catch { $("#portfolioPreview").innerHTML = "<span>Изображение недоступно</span>"; }
  }

  async function openPortfolioEditor(id = null, historyMode = "push") {
    clearPortfolioForm();
    document.body.classList.remove("section-portfolio");
    document.body.classList.add("portfolio-edit");
    $("#portfolioSection").hidden = true;
    $("#portfolioEditor").hidden = false;
    if (telegramBackButtonSupported) tg.BackButton.show();
    if (id) {
      try {
        const result = await api(`/api/crm/portfolio/${encodeURIComponent(id)}`);
        portfolio.current = result.item;
        for (const name of ["title", "caption", "altText", "bodyZone", "style", "year"]) $("#portfolioForm").elements[name].value = result.item[name] || "";
        $("#archivePortfolioButton").hidden = result.item.status === "archived";
        $("#publishPortfolioButton").textContent = result.item.status === "published" ? "Снять с публикации" : "Опубликовать";
        await showPortfolioImage(result.item);
      } catch (error) { setPortfolioFeedback(humanError(error), true); }
    }
    portfolio.dirty = false;
    updateSectionUrl("portfolio", id || "new", historyMode);
    window.scrollTo({ top:0, behavior:"auto" });
  }

  function setPortfolioFeedback(text, error = false) {
    const node = $("#portfolioFeedback");
    node.textContent = text;
    node.classList.toggle("error", error);
  }

  function portfolioPayload() {
    const form = new FormData($("#portfolioForm"));
    return {
      title:String(form.get("title") || "").trim(), caption:String(form.get("caption") || "").trim(),
      altText:String(form.get("altText") || "").trim(), bodyZone:String(form.get("bodyZone") || "").trim(),
      style:String(form.get("style") || "").trim(), year:form.get("year") || null,
      ...(portfolio.imageDataUrl ? { imageDataUrl:portfolio.imageDataUrl } : {})
    };
  }

  async function savePortfolio() {
    setPortfolioFeedback("Сохраняем…");
    const path = portfolio.current ? `/api/crm/portfolio/${portfolio.current.id}` : "/api/crm/portfolio";
    const method = portfolio.current ? "PATCH" : "POST";
    try {
      const result = await api(path, { method, body:JSON.stringify(portfolioPayload()) });
      portfolio.current = result.item;
      portfolio.imageDataUrl = null;
      portfolio.dirty = false;
      $("#archivePortfolioButton").hidden = false;
      updateSectionUrl("portfolio", result.item.id, "replace");
      setPortfolioFeedback("Сохранено");
      await loadPortfolio();
      return result.item;
    } catch (error) { setPortfolioFeedback(humanError(error), true); return null; }
  }

  async function closePortfolioEditor(historyMode = "push") {
    if (portfolio.dirty && !window.confirm("Не сохранять изменения?")) return;
    portfolio.dirty = false;
    if (telegramBackButtonSupported) tg.BackButton.hide();
    await showSection("portfolio", { historyMode });
    await loadPortfolio();
  }

  async function togglePortfolioPublish() {
    let item = portfolio.current;
    if (!item || portfolio.dirty) item = await savePortfolio();
    if (!item) return;
    const action = item.status === "published" ? "unpublish" : "publish";
    try {
      const result = await api(`/api/crm/portfolio/${item.id}/${action}`, { method:"POST" });
      portfolio.current = result.item;
      $("#publishPortfolioButton").textContent = result.item.status === "published" ? "Снять с публикации" : "Опубликовать";
      setPortfolioFeedback(result.item.status === "published" ? "Опубликовано на сайте" : "Снято с публикации");
      await loadPortfolio();
    } catch (error) { setPortfolioFeedback(humanError(error), true); }
  }

  async function movePortfolio(itemId, delta) {
    const active = portfolio.items.filter((item) => item.status !== "archived");
    const index = active.findIndex((item) => item.id === itemId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= active.length) return;
    [active[index], active[target]] = [active[target], active[index]];
    try {
      await api("/api/crm/portfolio/reorder", { method:"POST", body:JSON.stringify({ ids:active.map((item) => item.id) }) });
      await loadPortfolio();
    } catch (error) { setSync(humanError(error), true); }
  }

  async function handleBack() {
    if (document.body.classList.contains("portfolio-edit")) return closePortfolioEditor();
    if (document.body.classList.contains("detail-open")) return leaveDetailView();
  }

  async function boot() {
    tg?.ready(); tg?.expand();
    $("#authState").hidden = true;
    try {
      await api("/api/crm/me");
      $("#workspace").hidden = false;
      renderFilters();
      await load();
      const initial = new URLSearchParams(location.search);
      if (initial.get("section") === "portfolio" || initial.get("item")) await showSection("portfolio", { historyMode:"none", itemId:initial.get("item") && initial.get("item") !== "new" ? initial.get("item") : (initial.get("item") === "new" ? null : null) });
      if (initial.get("item") === "new") await openPortfolioEditor(null, "none");
      else if (requestedCode) await select(requestedCode, { historyMode:"replace" });
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
    if (document.body.classList.contains("section-portfolio")) { await loadPortfolio(); return; }
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
  document.querySelectorAll("[data-section]").forEach((button) => button.addEventListener("click", () => showSection(button.dataset.section)));
  $("#newPortfolioButton").addEventListener("click", () => openPortfolioEditor());
  $("#portfolioBack").addEventListener("click", () => closePortfolioEditor());
  $("#portfolioForm").addEventListener("input", () => { portfolio.dirty = true; setPortfolioFeedback(""); });
  $("#portfolioForm").addEventListener("submit", async (event) => { event.preventDefault(); await savePortfolio(); });
  $("#portfolioImage").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) { setPortfolioFeedback("Выберите JPG, PNG или WebP до 8 МБ.", true); return; }
    const reader = new FileReader();
    reader.onload = () => { portfolio.imageDataUrl = String(reader.result); portfolio.dirty = true; $("#portfolioPreview").innerHTML = `<img src="${portfolio.imageDataUrl}" alt="">`; setPortfolioFeedback(""); };
    reader.readAsDataURL(file);
  });
  $("#publishPortfolioButton").addEventListener("click", togglePortfolioPublish);
  $("#archivePortfolioButton").addEventListener("click", async () => {
    if (!portfolio.current || !window.confirm("Переместить работу в архив?")) return;
    try { await api(`/api/crm/portfolio/${portfolio.current.id}/archive`, { method:"POST" }); portfolio.dirty = false; await closePortfolioEditor(); } catch (error) { setPortfolioFeedback(humanError(error), true); }
  });
  $("#portfolioFilters").addEventListener("click", (event) => { const button = event.target.closest("[data-portfolio-status]"); if (!button) return; portfolio.status = button.dataset.portfolioStatus; loadPortfolio(); });
  $("#portfolioGrid").addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-portfolio]");
    if (open) { openPortfolioEditor(open.dataset.openPortfolio); return; }
    const move = event.target.closest("[data-move-portfolio]");
    if (move) movePortfolio(move.closest("[data-portfolio-id]").dataset.portfolioId, Number(move.dataset.movePortfolio));
  });
  let portfolioSearchTimer;
  $("#portfolioSearch").addEventListener("input", (event) => { clearTimeout(portfolioSearchTimer); portfolioSearchTimer = setTimeout(() => { portfolio.q = event.target.value.trim(); loadPortfolio(); }, 250); });
  if (telegramBackButtonSupported) tg.BackButton.onClick(handleBack);
  window.addEventListener("popstate", async () => {
    const current = new URLSearchParams(location.search);
    const item = current.get("item");
    if (item) { await showSection("portfolio", { historyMode:"none" }); await openPortfolioEditor(item === "new" ? null : item, "none"); return; }
    if (current.get("section") === "portfolio") { portfolio.dirty = false; await showSection("portfolio", { historyMode:"none" }); return; }
    const requestCode = current.get("request");
    await showSection("requests", { historyMode:"none" });
    if (requestCode) select(requestCode, { historyMode:"none" });
    else if (document.body.classList.contains("detail-open")) leaveDetailView("none");
  });
  window.addEventListener("pagehide", releaseAttachmentUrls);
  boot();
})();
