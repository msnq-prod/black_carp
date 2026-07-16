const views = [...document.querySelectorAll(".view")];
const navButtons = [...document.querySelectorAll("[data-nav]")];
const openButtons = [...document.querySelectorAll("[data-open-view]")];
const app = document.querySelector("#app");
const worksFeed = document.querySelector("#worksFeed");
const worksTopButton = document.querySelector("#worksTopButton");
const portfolioLightbox = document.querySelector("#portfolioLightbox");
const portfolioLightboxStage = document.querySelector("#portfolioLightboxStage");
const routeModal = document.querySelector("[data-route-modal]");
const routeOpenButtons = [...document.querySelectorAll("[data-open-route-gallery]")];
const routeCloseButtons = [...document.querySelectorAll("[data-route-close]")];
const bookingApiBase = (
  window.BLACK_CARP_API_BASE ||
  document.querySelector('meta[name="black-carp-api-base"]')?.content ||
  ""
).replace(/\/$/, "");
const bookingBotUsername = (
  window.BLACK_CARP_BOT_USERNAME ||
  document.querySelector('meta[name="black-carp-bot-username"]')?.content ||
  "blackcarp_bot"
).replace(/^@/, "");
const bookingRequestTimeoutMs = 15_000;
const viewTitles = {
  home: "Black Carp — авторская графика",
  works: "Работы — Black Carp",
  booking: "Запись — Black Carp",
  profile: "Профиль — Black Carp"
};

let publishedWorks = [];
let lightboxState = { workIndex:0, frameIndex:0, returnFocus:null };

function renderWorks(items) {
  publishedWorks = items;
  worksTopButton.hidden = items.length < 2;
  if (!items.length) {
    worksFeed.innerHTML = '<div class="works-state works-state--empty"><p class="eyebrow">ПОРТФОЛИО</p><h2>Новые работы<br>скоро появятся.</h2><p>Здесь будут опубликованы проекты мастера.</p></div>';
    return;
  }
  worksFeed.innerHTML = items
    .map(
      (work, index) => `
      <article class="work-slide" data-work-index="${index}">
        <div class="work-gallery" aria-label="Фотографии работы ${escapeHtml(work.title)}">
          <div class="work-gallery__track" data-gallery-track="${index}">
            ${work.media.map((media, mediaIndex) => `<figure class="work-frame"><button type="button" data-open-lightbox="${index}" data-frame-index="${mediaIndex}" aria-label="Открыть кадр ${mediaIndex + 1} из ${work.media.length}"><img src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.altText)}" loading="${index === 0 && mediaIndex === 0 ? "eager" : "lazy"}"></button></figure>`).join("")}
          </div>
          ${work.media.length > 1 ? `<div class="work-gallery__controls"><button type="button" data-gallery-step="-1" data-work-index="${index}" aria-label="Предыдущий кадр">‹</button><span data-gallery-counter="${index}">1 / ${work.media.length}</span><button type="button" data-gallery-step="1" data-work-index="${index}" aria-label="Следующий кадр">›</button></div>` : ""}
        </div>
        <div class="slide-index">РАБОТА ${String(index + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}</div>
        <div class="slide-caption">
          <h2>${escapeHtml(work.title)}</h2>
          <p>${escapeHtml(work.meta)}</p>
        </div>
      </article>
    `
    )
    .join("");
}

function renderWorksError() {
  publishedWorks = [];
  worksTopButton.hidden = true;
  worksFeed.innerHTML = '<div class="works-state works-state--error" role="alert"><p class="eyebrow">ПОРТФОЛИО</p><h2>Не удалось<br>загрузить работы.</h2><button type="button" data-retry-portfolio>Повторить</button></div>';
}

async function loadPublishedWorks() {
  try {
    const response = await fetch(`${bookingApiBase}/api/portfolio`, { headers:{ "Accept":"application/json" } });
    const data = await response.json();
    if (!response.ok || !data.ok || !Array.isArray(data.items)) throw new Error("portfolio_unavailable");
    renderWorks(data.items.map((item) => ({
      title:item.title,
      meta:[item.bodyZone, item.style, item.year].filter(Boolean).join(" / ") || item.caption || "Black Carp",
      media:(Array.isArray(item.media) && item.media.length ? item.media : (item.imageUrl ? [{ imageUrl:item.imageUrl, altText:item.altText || "" }] : []))
    })).filter((item) => item.media.length));
  } catch { renderWorksError(); }
}

loadPublishedWorks();

function setView(name) {
  views.forEach((view) => {
    view.classList.toggle("is-active", view.dataset.view === name);
  });

  navButtons.forEach((button) => {
    const isActive = button.dataset.nav === name;
    button.classList.toggle("is-active", isActive);
    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  document.title = viewTitles[name] || viewTitles.home;

  if (name === "works") {
    worksFeed.scrollTo({ top: 0, behavior: "auto" });
    app.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  } else {
    app.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  if (name === "profile") loadProfileStatus();
}

async function loadProfileStatus() {
  const codeNode = document.getElementById("profileCode");
  const statusNode = document.getElementById("profileStatusValue");
  const dateNode = document.getElementById("profileSubmittedAt");
  const messageNode = document.getElementById("profileMessage");
  const labels = { new:"Новая", in_review:"В работе", need_details:"Нужно уточнение", approved:"Согласована", scheduled:"Запланирована", done:"Завершена", cancelled:"Отменена" };
  let saved;
  try { saved = JSON.parse(localStorage.getItem("black_carp_last_booking") || "null"); } catch { saved = null; }
  if (!saved?.publicCode) {
    if (messageNode) messageNode.textContent = "На этом устройстве ещё нет отправленных заявок.";
    return;
  }
  if (codeNode) codeNode.textContent = saved.publicCode;
  if (dateNode) dateNode.textContent = new Intl.DateTimeFormat("ru-RU", { dateStyle:"medium", timeStyle:"short" }).format(new Date(saved.submittedAt));
  if (statusNode) statusNode.textContent = "Проверяем…";
  try {
    const response = await fetch(`${bookingApiBase}/api/booking/status/${encodeURIComponent(saved.publicCode)}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "status_failed");
    if (statusNode) statusNode.textContent = labels[data.status] || data.status;
    if (messageNode) messageNode.textContent = "Актуальный статус последней заявки.";
  } catch {
    if (statusNode) statusNode.textContent = "Временно недоступен";
    if (messageNode) messageNode.textContent = "Заявка сохранена. Статус обновится при восстановлении связи.";
  }
}

function navigateToView(name) {
  const hash = `#/${name}`;
  if (location.hash !== hash) location.hash = hash;
  setView(name);
}

function viewFromHash() {
  const value = location.hash.replace(/^#\/?/, "");
  return viewTitles[value] ? value : "home";
}

navButtons.forEach((button) => button.addEventListener("click", () => navigateToView(button.dataset.nav)));
openButtons.forEach((button) => button.addEventListener("click", () => navigateToView(button.dataset.openView)));
window.addEventListener("hashchange", () => setView(viewFromHash()));
setView(viewFromHash());

if (worksTopButton && worksFeed) {
  worksTopButton.addEventListener("click", () => {
    worksFeed.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function inlineGalleryIndex(track) {
  return Math.max(0, Math.min(track.children.length - 1, Math.round(track.scrollLeft / Math.max(1, track.clientWidth))));
}

function stepInlineGallery(workIndex, delta) {
  const track = worksFeed.querySelector(`[data-gallery-track="${workIndex}"]`);
  if (!track) return;
  const next = Math.max(0, Math.min(track.children.length - 1, inlineGalleryIndex(track) + delta));
  track.scrollTo({ left:next * track.clientWidth, behavior:"smooth" });
}

worksFeed.addEventListener("click", (event) => {
  const retry = event.target.closest("[data-retry-portfolio]");
  if (retry) { worksFeed.innerHTML = '<div class="works-state" role="status"><span class="works-loader" aria-hidden="true"></span><p>Загружаем работы…</p></div>'; loadPublishedWorks(); return; }
  const step = event.target.closest("[data-gallery-step]");
  if (step) { stepInlineGallery(Number(step.dataset.workIndex), Number(step.dataset.galleryStep)); return; }
  const open = event.target.closest("[data-open-lightbox]");
  if (open) openPortfolioLightbox(Number(open.dataset.openLightbox), Number(open.dataset.frameIndex), open);
});

let galleryScrollFrame = 0;
worksFeed.addEventListener("scroll", (event) => {
  const track = event.target.closest?.("[data-gallery-track]");
  if (!track) return;
  cancelAnimationFrame(galleryScrollFrame);
  galleryScrollFrame = requestAnimationFrame(() => {
    const counter = worksFeed.querySelector(`[data-gallery-counter="${track.dataset.galleryTrack}"]`);
    if (counter) counter.textContent = `${inlineGalleryIndex(track) + 1} / ${track.children.length}`;
  });
}, true);

function openPortfolioLightbox(workIndex, frameIndex, trigger) {
  const work = publishedWorks[workIndex];
  if (!portfolioLightbox || !work) return;
  lightboxState = { workIndex, frameIndex, returnFocus:trigger };
  document.querySelector("#portfolioLightboxTitle").textContent = work.title;
  portfolioLightboxStage.innerHTML = `<div class="portfolio-lightbox__track">${work.media.map((media) => `<figure><img src="${escapeHtml(media.imageUrl)}" alt="${escapeHtml(media.altText)}"></figure>`).join("")}</div>`;
  portfolioLightbox.hidden = false;
  portfolioLightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("portfolio-lightbox-open");
  requestAnimationFrame(() => {
    const track = portfolioLightboxStage.querySelector(".portfolio-lightbox__track");
    track.scrollTo({ left:frameIndex * track.clientWidth, behavior:"auto" });
    updateLightboxControls();
    portfolioLightbox.querySelector("[data-lightbox-close]")?.focus();
  });
}

function closePortfolioLightbox() {
  if (!portfolioLightbox || portfolioLightbox.hidden) return;
  portfolioLightbox.hidden = true;
  portfolioLightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("portfolio-lightbox-open");
  lightboxState.returnFocus?.focus?.({ preventScroll:true });
  lightboxState.returnFocus = null;
}

function updateLightboxControls() {
  const work = publishedWorks[lightboxState.workIndex];
  const track = portfolioLightboxStage?.querySelector(".portfolio-lightbox__track");
  if (!work || !track) return;
  lightboxState.frameIndex = inlineGalleryIndex(track);
  document.querySelector("#portfolioLightboxCounter").textContent = `${lightboxState.frameIndex + 1} / ${work.media.length}`;
  const previous = portfolioLightbox.querySelector('[data-lightbox-step="-1"]');
  const next = portfolioLightbox.querySelector('[data-lightbox-step="1"]');
  previous.disabled = lightboxState.frameIndex === 0;
  next.disabled = lightboxState.frameIndex === work.media.length - 1;
}

function stepPortfolioLightbox(delta) {
  const work = publishedWorks[lightboxState.workIndex];
  const track = portfolioLightboxStage?.querySelector(".portfolio-lightbox__track");
  if (!work || !track) return;
  const next = Math.max(0, Math.min(work.media.length - 1, lightboxState.frameIndex + delta));
  track.scrollTo({ left:next * track.clientWidth, behavior:"smooth" });
}

portfolioLightbox?.addEventListener("click", (event) => {
  if (event.target.closest("[data-lightbox-close]")) { closePortfolioLightbox(); return; }
  const step = event.target.closest("[data-lightbox-step]");
  if (step) stepPortfolioLightbox(Number(step.dataset.lightboxStep));
});

portfolioLightboxStage?.addEventListener("scroll", () => requestAnimationFrame(updateLightboxControls), true);

let routeModalReturnFocus = null;

function openRouteModal(trigger) {
  if (!routeModal) return;
  routeModalReturnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
  routeModal.hidden = false;
  routeModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => routeModal.querySelector("[data-route-close]")?.focus());
}

function closeRouteModal() {
  if (!routeModal) return;
  routeModal.hidden = true;
  routeModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  routeModalReturnFocus?.focus?.({ preventScroll: true });
  routeModalReturnFocus = null;
}

routeOpenButtons.forEach((button) => {
  button.addEventListener("click", () => openRouteModal(button));
});

routeCloseButtons.forEach((button) => {
  button.addEventListener("click", closeRouteModal);
});

document.addEventListener("keydown", (event) => {
  if (portfolioLightbox && !portfolioLightbox.hidden) {
    if (event.key === "Escape") { closePortfolioLightbox(); return; }
    if (event.key === "ArrowLeft") { stepPortfolioLightbox(-1); return; }
    if (event.key === "ArrowRight") { stepPortfolioLightbox(1); return; }
    if (event.key === "Tab") {
      const focusable = [...portfolioLightbox.querySelectorAll("button:not(:disabled)")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if (event.key === "Escape" && routeModal && !routeModal.hidden) {
    closeRouteModal();
    return;
  }
  if (event.key === "Tab" && routeModal && !routeModal.hidden) {
    const focusable = [...routeModal.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((node) => !node.disabled && node.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});


// ==========================================
// Booking Wizard Controller
// ==========================================

const wizardState = {
  firstTattoo: null,
  beenToMaster: null,
  hasSketch: null,
  sketchData: null,
  sketchComment: "",
  bodyZone: null,
  bodySubzone: null,
  bodySubzoneCustom: "",
  bodyView: "front",
  sizePreset: null,
  sizeCm: null,
  ideaText: "",
  referenceImages: [],
  clientName: "",
  contactType: "telegram",
  contactValue: "",
  contactComment: "",
  pendingReferenceReattachCount: 0
};

let wizardHistory = [2];
let wizardTransitionTimer = null;
let wizardTransitionLocked = false;
let renderLuxuryMenuControl = null;
let uploadGeneration = 0;
let sketchCompressionPromise = null;
const referenceCompressionPromises = new Set();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

const subzonesData = {
  head: ["Шея", "За ухом", "Голова", "Лицо"],
  torso: ["Грудь", "Ключицы", "Ребра", "Живот"],
  back: ["Лопатки", "Поясница", "Вдоль позвоночника", "Вся спина"],
  arms: ["Плечо", "Предплечье", "Бицепс", "Кисть", "Рукав"],
  legs: ["Бедро", "Икра / Голень", "Ступня", "Лодыжка"]
};

const zoneNamesRu = {
  head: "Голова и Шея",
  torso: "Грудь и Живот",
  back: "Спина",
  arms: "Руки",
  legs: "Ноги",
  other: "Другое"
};

const subzoneTranslations = {
  "Шея": "neck", "За ухом": "behindear", "Голова": "head", "Лицо": "face",
  "Грудь": "chest", "Ключицы": "collarbone", "Ребра": "ribs", "Живот": "stomach",
  "Лопатки": "shoulderblades", "Поясница": "lowerback", "Вдоль позвоночника": "spine", "Вся спина": "fullback",
  "Плечо": "shoulder", "Предплечье": "forearm", "Бицепс": "biceps", "Кисть": "wrist", "Рукав": "sleeve",
  "Бедро": "thigh", "Икра / Голень": "calfshin", "Ступня": "foot", "Лодыжка": "ankle", "Другое": "other"
};

const svgZoomStyles = {
  head: { scale: 2.8, origin: "50% 15%" },
  torso: { scale: 2.2, origin: "50% 40%" },
  back: { scale: 2.2, origin: "50% 40%" },
  arms: { scale: 2.0, origin: "50% 45%" },
  legs: { scale: 1.8, origin: "50% 75%" }
};

const sizePresetCmMap = {
  XS: 5,
  S: 10,
  M: 15,
  L: 20,
  XL: 30
};

const sizeVisualizerConfig = {
  phoneBaseHeight: 132,
  phoneBaseWidth: 76,
  phoneMinHeight: 78,
  phoneBaseFontSize: 14,
  phoneMinFontSize: 10.5,
  tattooMinSize: 44,
  tattooMatchSize: 132,
  tattooMaxSize: 152
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function getPresetSizeCm(preset) {
  return sizePresetCmMap[preset] || 15;
}

function getSizeVisualizerMetrics(cm) {
  const isCompactViewport = window.innerHeight <= 760;
  const phoneBaseHeight = isCompactViewport ? 96 : sizeVisualizerConfig.phoneBaseHeight;
  const phoneBaseWidth = sizeVisualizerConfig.phoneBaseWidth;
  const phoneMinHeight = isCompactViewport ? 58 : sizeVisualizerConfig.phoneMinHeight;
  const phoneBaseFontSize = isCompactViewport ? 12 : sizeVisualizerConfig.phoneBaseFontSize;
  const phoneMinFontSize = isCompactViewport ? 9.5 : sizeVisualizerConfig.phoneMinFontSize;
  const tattooMinSize = isCompactViewport ? 34 : sizeVisualizerConfig.tattooMinSize;
  const tattooMatchSize = isCompactViewport ? 86 : sizeVisualizerConfig.tattooMatchSize;
  const tattooMaxSize = isCompactViewport ? 104 : sizeVisualizerConfig.tattooMaxSize;

  if (!cm) {
    return {
      phoneHeight: phoneBaseHeight,
      phoneWidth: phoneBaseWidth,
      phoneFontSize: phoneBaseFontSize,
      tattooSize: tattooMinSize,
      tattooLabel: ""
    };
  }

  let phoneHeight = phoneBaseHeight;
  let phoneFontSize = phoneBaseFontSize;
  let tattooSize = tattooMatchSize;

  if (cm <= 15) {
    const progress = clamp((cm - 5) / 10, 0, 1);
    tattooSize = Math.round(lerp(tattooMinSize, tattooMatchSize, progress));
  } else {
    const progress = clamp((cm - 15) / 15, 0, 1);
    phoneHeight = Math.round(lerp(phoneBaseHeight, phoneMinHeight, progress));
    phoneFontSize = lerp(phoneBaseFontSize, phoneMinFontSize, progress);
    tattooSize = Math.round(lerp(tattooMatchSize, tattooMaxSize, progress));
  }

  return {
    phoneHeight,
    phoneWidth: Math.round(phoneHeight * (phoneBaseWidth / phoneBaseHeight)),
    phoneFontSize,
    tattooSize,
    tattooLabel: `${cm} см`
  };
}

// DOM elements cache
const wizardProgress = document.getElementById("wizardProgress");
const wizardStepIndicator = document.getElementById("wizardStepIndicator");
const wizardSlides = document.getElementById("wizardSlides");
const wizardBackBtn = document.getElementById("wizardBackBtn");
const wizardStepDots = document.getElementById("wizardStepDots");
const bodySilhouetteContainer = document.getElementById("bodySilhouetteContainer");
const svgGroupFront = document.getElementById("svgGroupFront");
const svgGroupBack = document.getElementById("svgGroupBack");
const subzonesPanel = document.getElementById("subzonesPanel");
const subzonesList = document.getElementById("subzonesList");
const selectedZoneName = document.getElementById("selectedZoneName");
const btnBackToSilhouette = document.getElementById("btnBackToSilhouette");
const sizeSliderVal = document.getElementById("sizeSliderVal");
const visualizerPhoneBox = document.getElementById("visualizerPhoneBox");
const visualizerTattooBox = document.getElementById("visualizerTattooBox");
const sizeNextBtn = document.getElementById("sizeNextBtn");
const sketchInput = document.getElementById("sketchInput");
const sketchUploader = document.getElementById("sketchUploader");
const sketchPreviewImg = document.getElementById("sketchPreviewImg");
const btnRemoveSketch = document.getElementById("btnRemoveSketch");
const sketchComment = document.getElementById("sketchComment");
const sketchNextBtn = document.getElementById("sketchNextBtn");
const refInput = document.getElementById("refInput");
const refUploader = document.getElementById("refUploader");
const refPreviewsContainer = document.getElementById("refPreviewsContainer");
const refRestoreNotice = document.getElementById("refRestoreNotice");
const bodyViewButtons = [...document.querySelectorAll("[data-body-view]")];
const tattooIdeaText = document.getElementById("tattooIdeaText");
const ideaNextBtn = document.getElementById("ideaNextBtn");
const wizardSummaryCard = document.getElementById("wizardSummaryCard");
const wizardPriceEstimate = document.getElementById("wizardPriceEstimate");
const wizardSubmitBtn = document.getElementById("wizardSubmitBtn");
const wizardRestartBtn = document.getElementById("wizardRestartBtn");
const wizardToast = document.getElementById("wizardToast");
const bookingConsent = document.getElementById("bookingConsent");
const bookingClientName = document.getElementById("bookingClientName");
const bookingContactType = document.getElementById("bookingContactType");
const bookingContactValue = document.getElementById("bookingContactValue");
const bookingContactComment = document.getElementById("bookingContactComment");
const bookingConfirmationForm = document.getElementById("bookingConfirmationForm");
const bookingSuccess = document.getElementById("bookingSuccess");
const bookingSuccessCode = document.getElementById("bookingSuccessCode");
const wizardSuccessRestartBtn = document.getElementById("wizardSuccessRestartBtn");
let wizardToastTimer = null;

function showToast(msg) {
  if (!wizardToast) return;
  const message = wizardToast.querySelector(".toast-message");
  if (message) message.textContent = msg;
  wizardToast.style.display = "flex";
  wizardToast.style.animation = "";
  if (wizardToastTimer) window.clearTimeout(wizardToastTimer);
  wizardToastTimer = window.setTimeout(() => {
    wizardToast.style.display = "none";
    wizardToastTimer = null;
  }, 3300);
}

// Compression utility
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("image_read_failed"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("image_decode_failed"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }

        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("image_canvas_failed"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function setImageProcessingState(button, uploader, busy) {
  if (button) {
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    const label = button.querySelector("span");
    if (label) label.textContent = busy ? "Обрабатываем изображение…" : "Продолжить";
  }
  if (uploader) {
    if (busy) uploader.setAttribute("aria-busy", "true");
    else uploader.removeAttribute("aria-busy");
  }
}

function hasPendingImageProcessing() {
  return Boolean(sketchCompressionPromise || referenceCompressionPromises.size);
}

function getWizardTotalSteps() {
  const historySteps = wizardHistory.map(String);
  if (historySteps.length === 1 && historySteps[0] === "2") {
    return 7;
  }
  const masterStep = historySteps.includes("3") || wizardState.firstTattoo === "no" && historySteps.length > 1 ? 1 : 0;
  const uploadStep = historySteps.includes("4a") || wizardState.hasSketch && historySteps.includes("4") && historySteps.length > 3 ? 1 : 0;
  return 6 + masterStep + uploadStep;
}

// Render progress
function updateProgress(step) {
  if (!wizardProgress) return;
  const stepIndex = wizardHistory.length;
  const totalSteps = getWizardTotalSteps();
  const pct = Math.min(100, Math.max(14, (stepIndex / totalSteps) * 100));
  wizardProgress.style.width = `${pct}%`;

  if (wizardStepIndicator) {
    wizardStepIndicator.textContent = `Шаг ${Math.min(stepIndex, totalSteps)} из ${totalSteps}`;
  }
  const progress = wizardProgress.closest("[role='progressbar']");
  if (progress) {
    progress.setAttribute("aria-valuemax", String(totalSteps));
    progress.setAttribute("aria-valuenow", String(Math.min(stepIndex, totalSteps)));
  }

  // Control back button visibility
  if (wizardBackBtn) {
    if (stepIndex > 1) {
      wizardBackBtn.classList.add("is-visible");
    } else {
      wizardBackBtn.classList.remove("is-visible");
    }
  }

  // Render dots
  if (wizardStepDots) {
    const totalDots = totalSteps;
    let dotsHtml = "";
    for (let i = 1; i <= totalDots; i++) {
      const isActive = i === Math.min(stepIndex, totalSteps);
      dotsHtml += `<div class="wizard-dot ${isActive ? "active" : ""}"></div>`;
    }
    wizardStepDots.innerHTML = dotsHtml;
  }
}

// Show Slide
function goToSlide(step) {
  const slides = [...document.querySelectorAll(".wizard-slide")];
  slides.forEach(slide => {
    if (slide.dataset.step === String(step)) {
      slide.classList.add("is-active");
    } else {
      slide.classList.remove("is-active");
    }
  });

  updateProgress(step);
  if (String(step) === "7" && wizardState.pendingReferenceReattachCount > 0 && refRestoreNotice) {
    const count = wizardState.pendingReferenceReattachCount;
    refRestoreNotice.hidden = false;
    refRestoreNotice.textContent = `После обновления прикрепите ${count} ${count === 1 ? "референс" : "референса"} заново или продолжите без них.`;
  }
  saveStateToStorage();
  const activeHeading = document.querySelector(`.wizard-slide[data-step="${step}"] .wizard-question-title`);
  if (activeHeading) {
    activeHeading.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => activeHeading.focus({ preventScroll: true }));
  }
}

function setWizardTransitionState(locked) {
  wizardTransitionLocked = locked;
  wizardSlides?.classList.toggle("is-transitioning", locked);
  if (locked) wizardSlides?.setAttribute("aria-busy", "true");
  else wizardSlides?.removeAttribute("aria-busy");
}

function cancelScheduledTransition() {
  if (wizardTransitionTimer) window.clearTimeout(wizardTransitionTimer);
  wizardTransitionTimer = null;
  setWizardTransitionState(false);
}

function scheduleNextStep(target, delay = 250) {
  if (wizardTransitionLocked) return false;
  setWizardTransitionState(true);
  wizardTransitionTimer = window.setTimeout(() => {
    wizardTransitionTimer = null;
    setWizardTransitionState(false);
    nextStep(target);
  }, delay);
  return true;
}

function syncBodyViewControls() {
  bodyViewButtons.forEach((button) => {
    const isActive = button.dataset.bodyView === wizardState.bodyView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setBodyView(view, { save = true } = {}) {
  if (!['front', 'back'].includes(view)) return;
  wizardState.bodyView = view;
  const incompatibleZone = (view === "front" && wizardState.bodyZone === "back")
    || (view === "back" && wizardState.bodyZone === "torso");
  if (incompatibleZone) {
    wizardState.bodyZone = null;
    wizardState.bodySubzone = null;
    wizardState.bodySubzoneCustom = "";
    renderLuxuryMenuControl?.();
    if (save) showToast("Выберите зону для этой стороны тела заново.");
  }
  syncBodyViewControls();
  if (save) saveStateToStorage();
}

function nextStep(target) {
  if (String(wizardHistory.at(-1)) === String(target)) return;
  wizardHistory.push(target);
  goToSlide(target);
}

function prevStep() {
  cancelScheduledTransition();
  if (wizardHistory.length > 1) {
    wizardHistory.pop();
    const target = wizardHistory[wizardHistory.length - 1];
    goToSlide(target);
  }
}

// Reset Wizard
function resetWizard() {
  cancelScheduledTransition();
  if (wizardToastTimer) window.clearTimeout(wizardToastTimer);
  wizardToastTimer = null;
  if (wizardToast) wizardToast.style.display = "none";
  uploadGeneration += 1;
  sketchCompressionPromise = null;
  referenceCompressionPromises.clear();
  setImageProcessingState(sketchNextBtn, sketchUploader, false);
  setImageProcessingState(ideaNextBtn, refUploader, false);
  wizardState.firstTattoo = null;
  wizardState.beenToMaster = null;
  wizardState.hasSketch = null;
  wizardState.sketchData = null;
  wizardState.sketchComment = "";
  wizardState.bodyZone = null;
  wizardState.bodySubzone = null;
  wizardState.bodySubzoneCustom = "";
  wizardState.bodyView = "front";
  wizardState.sizePreset = null;
  wizardState.sizeCm = null;
  wizardState.ideaText = "";
  wizardState.referenceImages = [];
  wizardState.clientName = "";
  wizardState.contactType = "telegram";
  wizardState.contactValue = "";
  wizardState.contactComment = "";
  wizardState.pendingReferenceReattachCount = 0;

  wizardHistory = [2];

  // UI Resets
  document.querySelectorAll(".option-card").forEach(c => { c.classList.remove("selected"); c.setAttribute("aria-pressed", "false"); });
  document.querySelectorAll(".size-preset-card").forEach(c => { c.classList.remove("selected"); c.setAttribute("aria-pressed", "false"); });

  if (sketchPreviewImg) sketchPreviewImg.src = "";
  if (sketchInput) sketchInput.value = "";
  if (sketchUploader) {
    sketchUploader.querySelector(".uploader-zone").style.display = "flex";
    sketchUploader.querySelector(".uploader-preview").style.display = "none";
  }
  if (sketchComment) sketchComment.value = "";
  if (refPreviewsContainer) {
    refPreviewsContainer.innerHTML = "";
    refPreviewsContainer.style.display = "none";
  }
  if (refInput) refInput.value = "";
  if (refRestoreNotice) {
    refRestoreNotice.hidden = true;
    refRestoreNotice.textContent = "";
  }
  if (tattooIdeaText) tattooIdeaText.value = "";
  if (sizeSliderVal) sizeSliderVal.textContent = "";
  updateSizeVisualizer(null);
  if (sizeNextBtn) {
    const label = sizeNextBtn.querySelector("span");
    if (label) label.textContent = "Продолжить без размера";
  }
  if (bookingConsent) { bookingConsent.checked = false; bookingConsent.removeAttribute("aria-invalid"); }
  if (bookingClientName) bookingClientName.value = "";
  if (bookingContactType) bookingContactType.value = "telegram";
  if (bookingContactValue) bookingContactValue.value = "";
  if (bookingContactComment) bookingContactComment.value = "";
  for (const field of [bookingClientName, bookingContactValue]) field?.removeAttribute("aria-invalid");
  if (bookingConfirmationForm) bookingConfirmationForm.hidden = false;
  if (bookingSuccess) bookingSuccess.hidden = true;
  if (wizardSubmitBtn) {
    wizardSubmitBtn.disabled = false;
    const submitLabel = wizardSubmitBtn.querySelector("span");
    if (submitLabel) submitLabel.textContent = "Отправить заявку";
  }

  resetBodySilhouette();
  syncBodyViewControls();
  renderLuxuryMenuControl?.();
  localStorage.removeItem("black_carp_booking_idempotency_key");
  localStorage.removeItem("black_carp_booking_state");
  localStorage.removeItem("black_carp_booking_history");
  goToSlide(2);
}

// SVG Silhouette Resets
function resetBodySilhouette() {
  if (bodySilhouetteContainer) {
    bodySilhouetteContainer.style.transformOrigin = "center center";
    bodySilhouetteContainer.style.transform = "scale(1)";
  }
  document.querySelectorAll(".body-zone").forEach(z => z.classList.remove("active-zone"));

  const container = document.querySelector(".body-map-container");
  if (container) container.classList.remove("zone-selected");
}

// Setup Event Listeners
function initWizard() {
  if (!document.getElementById("bookingWizard")) return;
  document.querySelectorAll(".option-card, .size-preset-card").forEach((button) => button.setAttribute("aria-pressed", String(button.classList.contains("selected"))));

  // Option Cards
  document.querySelectorAll(".wizard-slide[data-step='2'] .option-card").forEach(card => {
    card.addEventListener("click", () => {
      if (wizardTransitionLocked) return;
      const val = card.dataset.value;
      wizardState.firstTattoo = val;

      document.querySelectorAll(".wizard-slide[data-step='2'] .option-card").forEach(c => { c.classList.remove("selected"); c.setAttribute("aria-pressed", "false"); });
      card.classList.add("selected");
      card.setAttribute("aria-pressed", "true");

      scheduleNextStep(card.dataset.next);
    });
  });

  document.querySelectorAll(".wizard-slide[data-step='3'] .option-card").forEach(card => {
    card.addEventListener("click", () => {
      if (wizardTransitionLocked) return;
      const val = card.dataset.value;
      wizardState.beenToMaster = val;

      document.querySelectorAll(".wizard-slide[data-step='3'] .option-card").forEach(c => { c.classList.remove("selected"); c.setAttribute("aria-pressed", "false"); });
      card.classList.add("selected");
      card.setAttribute("aria-pressed", "true");

      scheduleNextStep(card.dataset.next);
    });
  });

  document.querySelectorAll(".wizard-slide[data-step='4'] .option-card").forEach(card => {
    card.addEventListener("click", () => {
      if (wizardTransitionLocked) return;
      const val = card.dataset.value;
      wizardState.hasSketch = (val === "yes");
      if (!wizardState.hasSketch) {
        sketchCompressionPromise = null;
        wizardState.sketchData = null;
        wizardState.sketchComment = "";
        setImageProcessingState(sketchNextBtn, sketchUploader, false);
        if (sketchInput) sketchInput.value = "";
        if (sketchPreviewImg) sketchPreviewImg.src = "";
        if (sketchComment) sketchComment.value = "";
        if (sketchUploader) {
          sketchUploader.querySelector(".uploader-zone").style.display = "flex";
          sketchUploader.querySelector(".uploader-preview").style.display = "none";
        }
      }

      document.querySelectorAll(".wizard-slide[data-step='4'] .option-card").forEach(c => { c.classList.remove("selected"); c.setAttribute("aria-pressed", "false"); });
      card.classList.add("selected");
      card.setAttribute("aria-pressed", "true");

      scheduleNextStep(card.dataset.next);
    });
  });

  // Next triggers on Welcome slide
  document.querySelectorAll(".wizard-next-trigger[data-next]").forEach(btn => {
    btn.addEventListener("click", () => {
      nextStep(btn.dataset.next);
    });
  });

  // Back button
  if (wizardBackBtn) {
    wizardBackBtn.addEventListener("click", prevStep);
  }

  // Restart Button
  if (wizardRestartBtn) {
    wizardRestartBtn.addEventListener("click", resetWizard);
  }
  if (wizardSuccessRestartBtn) wizardSuccessRestartBtn.addEventListener("click", resetWizard);
  [bookingClientName, bookingContactValue, bookingContactComment].forEach((field) => field?.addEventListener("input", () => {
    if (field === bookingClientName) wizardState.clientName = field.value;
    if (field === bookingContactValue) wizardState.contactValue = field.value;
    if (field === bookingContactComment) wizardState.contactComment = field.value;
    field.removeAttribute("aria-invalid");
    saveStateToStorage();
  }));
  bookingContactType?.addEventListener("change", () => { wizardState.contactType = bookingContactType.value; saveStateToStorage(); });
  bookingConsent?.addEventListener("change", () => bookingConsent.removeAttribute("aria-invalid"));
  bodyViewButtons.forEach((button) => button.addEventListener("click", () => setBodyView(button.dataset.bodyView)));

  // File Upload 1 (Sketch)
  if (sketchUploader && sketchInput) {
    sketchUploader.addEventListener("click", (e) => {
      if (!e.target.closest(".btn-remove-file")) {
        sketchInput.click();
      }
    });

    sketchInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        const generation = uploadGeneration;
        const compression = compressImage(file);
        sketchCompressionPromise = compression;
        setImageProcessingState(sketchNextBtn, sketchUploader, true);
        try {
          const base64 = await compression;
          if (generation !== uploadGeneration || sketchCompressionPromise !== compression) return;
          wizardState.sketchData = base64;
          if (sketchPreviewImg) sketchPreviewImg.src = base64;
          sketchUploader.querySelector(".uploader-zone").style.display = "none";
          sketchUploader.querySelector(".uploader-preview").style.display = "flex";
          saveStateToStorage();
        } catch {
          if (generation === uploadGeneration && sketchCompressionPromise === compression) {
            showToast("Не удалось обработать изображение. Выберите другой файл.");
          }
        } finally {
          if (sketchCompressionPromise === compression) {
            sketchCompressionPromise = null;
            setImageProcessingState(sketchNextBtn, sketchUploader, false);
          }
        }
        sketchInput.value = "";
      }
    });
  }

  if (btnRemoveSketch) {
    btnRemoveSketch.addEventListener("click", (e) => {
      e.stopPropagation();
      sketchCompressionPromise = null;
      setImageProcessingState(sketchNextBtn, sketchUploader, false);
      wizardState.sketchData = null;
      if (sketchInput) sketchInput.value = "";
      if (sketchPreviewImg) sketchPreviewImg.src = "";
      if (sketchUploader) {
        sketchUploader.querySelector(".uploader-zone").style.display = "flex";
        sketchUploader.querySelector(".uploader-preview").style.display = "none";
      }
    });
  }

  if (sketchNextBtn) {
    sketchNextBtn.addEventListener("click", () => {
      if (sketchCompressionPromise) {
        showToast("Дождитесь обработки эскиза.");
        return;
      }
      if (wizardState.hasSketch && !wizardState.sketchData) {
        showToast("Добавьте файл эскиза, чтобы продолжить.");
        sketchUploader?.querySelector(".uploader-zone")?.focus();
        return;
      }
      if (sketchComment) wizardState.sketchComment = sketchComment.value;
      nextStep(5);
    });
  }

  // File Upload 2 (References)
  if (refUploader && refInput) {
    refUploader.addEventListener("click", (e) => {
      if (!e.target.closest(".btn-remove-item")) {
        refInput.click();
      }
    });

    refInput.addEventListener("change", (e) => {
      const files = [...e.target.files];
      const maxRefs = 3;
      const currentCount = wizardState.referenceImages.length + referenceCompressionPromises.size;
      const allowed = maxRefs - currentCount;
      const generation = uploadGeneration;

      files.slice(0, allowed).forEach(file => {
        const compression = compressImage(file);
        referenceCompressionPromises.add(compression);
        setImageProcessingState(ideaNextBtn, refUploader, true);
        compression.then((base64) => {
          if (generation !== uploadGeneration || !referenceCompressionPromises.has(compression)) return;
          wizardState.referenceImages.push(base64);
          wizardState.pendingReferenceReattachCount = 0;
          if (refRestoreNotice) {
            refRestoreNotice.hidden = true;
            refRestoreNotice.textContent = "";
          }
          renderRefPreviews();
          saveStateToStorage();
        }).catch(() => {
          if (generation === uploadGeneration && referenceCompressionPromises.has(compression)) {
            showToast("Один из референсов не удалось обработать.");
          }
        }).finally(() => {
          referenceCompressionPromises.delete(compression);
          if (!referenceCompressionPromises.size) setImageProcessingState(ideaNextBtn, refUploader, false);
        });
      });
      refInput.value = "";
    });
  }

  function renderRefPreviews() {
    if (!refPreviewsContainer) return;
    if (wizardState.referenceImages.length > 0) {
      refPreviewsContainer.style.display = "grid";
      refPreviewsContainer.innerHTML = wizardState.referenceImages.map((img, idx) => `
        <div class="uploader-preview-item">
          <img src="${img}" alt="Референс ${idx + 1}">
          <button type="button" class="btn-remove-item" data-index="${idx}" aria-label="Удалить референс ${idx + 1}">
            <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      `).join("");


      // Bind remove actions
      refPreviewsContainer.querySelectorAll(".btn-remove-item").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index);
          wizardState.referenceImages.splice(idx, 1);
          renderRefPreviews();
          if (refInput) refInput.value = "";
          saveStateToStorage();
        });
      });
    } else {
      refPreviewsContainer.style.display = "none";
      refPreviewsContainer.innerHTML = "";
    }
  }

  if (ideaNextBtn) {
    ideaNextBtn.addEventListener("click", () => {
      if (referenceCompressionPromises.size) {
        showToast("Дождитесь обработки референсов.");
        return;
      }
      if (tattooIdeaText) wizardState.ideaText = tattooIdeaText.value;
      wizardState.pendingReferenceReattachCount = 0;
      if (refRestoreNotice) {
        refRestoreNotice.hidden = true;
        refRestoreNotice.textContent = "";
      }
      renderSummary();
      nextStep(8);
    });
  }

  // Luxury Body Menu (Plan B)
  const luxuryBodyMenu = document.getElementById("luxuryBodyMenu");

  function renderLuxuryMenu() {
    if (!luxuryBodyMenu) return;
    luxuryBodyMenu.innerHTML = "";

    const zones = ["head", "torso", "back", "arms", "legs", "other"];

    zones.forEach(zone => {
      const zoneName = zoneNamesRu[zone] || zone;
      const subzones = subzonesData[zone] || [];

      const zoneGroup = document.createElement("div");
      zoneGroup.className = "luxury-zone-group";

      const zoneBtn = document.createElement("button");
      zoneBtn.type = "button";
      zoneBtn.className = `luxury-zone-btn ${wizardState.bodyZone === zone ? "active" : ""}`;
      zoneBtn.setAttribute("aria-expanded", String(wizardState.bodyZone === zone));
      zoneBtn.setAttribute("aria-controls", `body-zone-${zone}`);
      zoneBtn.innerHTML = `<span>${zoneName}</span><svg class="chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>`;

      const subzoneContainer = document.createElement("div");
      subzoneContainer.className = "luxury-subzones-container";
      subzoneContainer.id = `body-zone-${zone}`;
      if (wizardState.bodyZone === zone) {
        subzoneContainer.style.display = "grid";
      } else {
        subzoneContainer.style.display = "none";
      }

      subzones.forEach(sz => {
        const szBtn = document.createElement("button");
        szBtn.type = "button";
        szBtn.className = `luxury-subzone-btn ${wizardState.bodySubzone === sz ? "selected" : ""}`;
        szBtn.setAttribute("aria-pressed", String(wizardState.bodySubzone === sz));
        szBtn.textContent = sz;
        szBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (wizardTransitionLocked) return;
          wizardState.bodyZone = zone;
          wizardState.bodySubzone = sz;
          wizardState.bodySubzoneCustom = "";
          if (zone === "back") setBodyView("back", { save:false });
          if (zone === "torso") setBodyView("front", { save:false });

          document.querySelectorAll(".luxury-subzone-btn").forEach(b => { b.classList.remove("selected"); b.setAttribute("aria-pressed", "false"); });
          szBtn.classList.add("selected");
          szBtn.setAttribute("aria-pressed", "true");

          saveStateToStorage();
          scheduleNextStep(6, 300);
        });
        subzoneContainer.appendChild(szBtn);
      });

      if (zone === "other") {
        const customWrap = document.createElement("div");
        customWrap.className = "luxury-subzone-custom visible";

        const submitCustomSubzone = () => {
          const value = customInput.value.trim();
          if (!value) return;
          wizardState.bodyZone = "other";
          wizardState.bodySubzone = "Другое";
          wizardState.bodySubzoneCustom = value;
          saveStateToStorage();
          nextStep(6);
        };

        const customInput = document.createElement("input");
        customInput.type = "text";
        customInput.id = "luxurySubzoneCustomInput";
        customInput.className = "luxury-subzone-custom-input";
        customInput.placeholder = "свой вариант";
        customInput.setAttribute("aria-label", "Своя зона тела");
        customInput.value = wizardState.bodySubzoneCustom || "";
        customInput.maxLength = 80;

        customInput.addEventListener("click", (e) => e.stopPropagation());
        customInput.addEventListener("focus", () => {
          wizardState.bodyZone = "other";
          wizardState.bodySubzone = "Другое";
          zoneBtn.classList.add("active");
          zoneBtn.setAttribute("aria-expanded", "true");
          subzoneContainer.style.display = "grid";
        });
        customInput.addEventListener("input", () => {
          wizardState.bodyZone = "other";
          wizardState.bodySubzone = "Другое";
          wizardState.bodySubzoneCustom = customInput.value.trim();
        });
        customInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submitCustomSubzone();
          }
        });
        customInput.addEventListener("blur", () => {
          wizardState.bodySubzoneCustom = customInput.value.trim();
        });

        const customSubmitBtn = document.createElement("button");
        customSubmitBtn.type = "button";
        customSubmitBtn.className = "luxury-subzone-custom-submit";
        customSubmitBtn.setAttribute("aria-label", "Продолжить");
        customSubmitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M13 5l7 7-7 7"></path>
          </svg>
        `;
        customSubmitBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          submitCustomSubzone();
        });

        customWrap.appendChild(customInput);
        customWrap.appendChild(customSubmitBtn);
        subzoneContainer.appendChild(customWrap);
      }

      zoneBtn.addEventListener("click", () => {
        // Toggle accordion
        const isActive = wizardState.bodyZone === zone;

        // Close all others
        document.querySelectorAll(".luxury-zone-btn").forEach(b => { b.classList.remove("active"); b.setAttribute("aria-expanded", "false"); });
        document.querySelectorAll(".luxury-subzones-container").forEach(c => c.style.display = "none");

        if (!isActive) {
          wizardState.bodyZone = zone;
          wizardState.bodySubzone = null;
          wizardState.bodySubzoneCustom = "";
          zoneBtn.classList.add("active");
          zoneBtn.setAttribute("aria-expanded", "true");
          subzoneContainer.style.display = "grid";
          if (zone === "back") setBodyView("back", { save:false });
          if (zone === "torso") setBodyView("front", { save:false });
        } else {
          wizardState.bodyZone = null;
          wizardState.bodySubzone = null;
        }
        saveStateToStorage();
      });

      zoneGroup.appendChild(zoneBtn);
      zoneGroup.appendChild(subzoneContainer);
      luxuryBodyMenu.appendChild(zoneGroup);
    });
  }
  renderLuxuryMenuControl = renderLuxuryMenu;

  function getBodySubzoneLabel() {
    if (wizardState.bodySubzone === "Другое" && wizardState.bodySubzoneCustom) {
      return wizardState.bodySubzoneCustom;
    }
    return wizardState.bodySubzone || "";
  }

  // Call it initially
  renderLuxuryMenu();

  // Size preset cards
  document.querySelectorAll(".size-preset-card").forEach(card => {
    card.addEventListener("click", () => {
      const preset = card.dataset.sizePreset;
      wizardState.sizePreset = preset;

      document.querySelectorAll(".size-preset-card").forEach(c => { c.classList.remove("selected"); c.setAttribute("aria-pressed", "false"); });
      card.classList.add("selected");
      card.setAttribute("aria-pressed", "true");

      const sizeCm = getPresetSizeCm(preset);
      wizardState.sizeCm = sizeCm;
      if (sizeSliderVal) {
        sizeSliderVal.textContent = `${sizeCm} см`;
      }

      updateSizeVisualizer(sizeCm);
      if (sizeNextBtn) {
        const label = sizeNextBtn.querySelector("span");
        if (label) label.textContent = "Продолжить";
      }
    });
  });

  // Next triggers on Size
  if (sizeNextBtn) {
    sizeNextBtn.addEventListener("click", () => {
      nextStep(7);
    });
  }

  // Summary builder
  function renderSummary() {
    if (!wizardSummaryCard) return;

    let experienceText = wizardState.firstTattoo === "yes" ? "Первая татуировка" : "Есть татуировки";
    if (wizardState.beenToMaster === "yes") {
      experienceText += " (был у этого мастера)";
    } else if (wizardState.beenToMaster === "no") {
      experienceText += " (впервые у мастера)";
    }

    const sketchText = wizardState.hasSketch
      ? `Да ${wizardState.sketchData ? "(эскиз загружен)" : ""}`
      : "Нет, нужна разработка";

    const sideText = wizardState.bodyView === "front" ? "спереди" : "сзади";
    const zoneNameText = zoneNamesRu[wizardState.bodyZone] || "Любая";
    const subzoneText = getBodySubzoneLabel() || "Не выбрано";
    const locationText = `${zoneNameText} — ${subzoneText} (${sideText})`;

    const sizeText = wizardState.sizeCm
      ? `${wizardState.sizeCm} см (Пресет ${wizardState.sizePreset})`
      : "Не выбран";

    const ideaTextShort = wizardState.ideaText.trim()
      ? (wizardState.ideaText.length > 80 ? wizardState.ideaText.slice(0, 80) + "..." : wizardState.ideaText)
      : "Не указано";

    wizardSummaryCard.innerHTML = `
      <div class="summary-row">
        <span class="summary-label">Опыт:</span>
        <span class="summary-value">${escapeHtml(experienceText)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Свой эскиз:</span>
        <span class="summary-value">${escapeHtml(sketchText)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Зона тела:</span>
        <span class="summary-value">${escapeHtml(locationText)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Размер:</span>
        <span class="summary-value">${escapeHtml(sizeText)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Идея:</span>
        <span class="summary-value">${escapeHtml(ideaTextShort)}</span>
      </div>
    `;

    // Estimate price
    const est = estimatePrice(wizardState.bodyZone, wizardState.bodySubzone, wizardState.sizeCm, wizardState.sizePreset);
    if (wizardPriceEstimate) wizardPriceEstimate.textContent = est;
  }
  window.renderBlackCarpBookingSummary = renderSummary;

  function estimatePrice(zone, subzone, sizeCm, sizePreset) {
    if (!sizeCm) return "После консультации";
    if (sizePreset === "XL" || sizeCm >= 30) {
      if (["Рукав", "Штанина", "Вся спина"].includes(subzone)) {
        return "от 35 000 ₽";
      }
      return "от 25 000 ₽";
    }
    if (sizeCm <= 5) return "7 000 – 9 000 ₽";
    if (sizeCm <= 10) return "9 000 – 12 000 ₽";
    if (sizeCm <= 15) return "12 000 – 18 000 ₽";
    if (sizeCm <= 20) return "18 000 – 25 000 ₽";
    return "от 25 000 ₽";
  }

  // Submit action
  if (wizardSubmitBtn) {
    wizardSubmitBtn.addEventListener("click", async () => {
      if (hasPendingImageProcessing()) {
        showToast("Дождитесь обработки изображений.");
        return;
      }
      if (!validateContactFields()) return;
      if (!bookingConsent?.checked) {
        bookingConsent?.setAttribute("aria-invalid", "true");
        bookingConsent?.focus();
        showToast("Подтвердите согласие на отправку анкеты.");
        return;
      }

      const textReport = compileTextReport();
      const originalLabel = wizardSubmitBtn.querySelector("span")?.textContent || "Отправить заявку";
      setSubmitState(true, "Отправляем анкету");

      try {
        const result = await submitBookingToApi();
        showBookingSuccess(result);
      } catch (err) {
        console.error("Booking submit failed: ", err);
        const copied = await copyToClipboard(textReport);
        showToast(copied
          ? "Нет связи с сервером. Резюме с контактом скопировано — анкета сохранена, попробуйте ещё раз."
          : "Нет связи с сервером. Анкета сохранена на устройстве — проверьте интернет и повторите отправку.");
        setSubmitState(false, originalLabel);
      }
    });
  }

  function validateContactFields() {
    const name = bookingClientName?.value.trim() || "";
    const contact = bookingContactValue?.value.trim() || "";
    const contactType = bookingContactType?.value || "telegram";
    for (const field of [bookingClientName, bookingContactValue]) field?.removeAttribute("aria-invalid");
    if (name.length < 2 || name.length > 80) {
      bookingClientName?.setAttribute("aria-invalid", "true");
      bookingClientName?.focus();
      showToast("Укажите имя — от 2 до 80 символов.");
      return false;
    }
    if (contact.length < 3 || contact.length > 120) {
      bookingContactValue?.setAttribute("aria-invalid", "true");
      bookingContactValue?.focus();
      showToast("Укажите Telegram, телефон или другой контакт.");
      return false;
    }
    if (contactType === "telegram" && !/^@?[A-Za-z0-9_]{5,32}$/.test(contact)) {
      bookingContactValue?.setAttribute("aria-invalid", "true");
      bookingContactValue?.focus();
      showToast("Укажите корректный Telegram username.");
      return false;
    }
    if (contactType === "phone" && (!/^[+\d\s()-]+$/.test(contact) || (contact.match(/\d/g) || []).length < 7 || (contact.match(/\d/g) || []).length > 15)) {
      bookingContactValue?.setAttribute("aria-invalid", "true");
      bookingContactValue?.focus();
      showToast("Укажите корректный номер телефона.");
      return false;
    }
    wizardState.clientName = name;
    wizardState.contactType = contactType;
    wizardState.contactValue = contact;
    wizardState.contactComment = bookingContactComment?.value.trim() || "";
    saveStateToStorage();
    return true;
  }

  function showBookingSuccess(result) {
    localStorage.removeItem("black_carp_booking_idempotency_key");
    localStorage.removeItem("black_carp_booking_state");
    localStorage.removeItem("black_carp_booking_history");
    if (bookingConfirmationForm) bookingConfirmationForm.hidden = true;
    if (bookingSuccess) {
      bookingSuccess.hidden = false;
      const message = bookingSuccess.querySelector("p:not(.screen-label)");
      if (message) message.textContent = result.masterNotified
        ? "Мастер получил вашу анкету и свяжется по указанному контакту."
        : "Заявка сохранена. Мастер получит уведомление сразу после восстановления связи.";
      bookingSuccess.focus();
    }
    if (bookingSuccessCode) bookingSuccessCode.textContent = result.publicCode || "";
    setSubmitState(true, "Заявка отправлена");
  }

  function openTelegramLink(url, originalLabel) {
    window.location.assign(url);
    setTimeout(() => {
      setSubmitState(false, originalLabel);
    }, 2500);
  }

  function setSubmitState(isSubmitting, label) {
    if (!wizardSubmitBtn) return;
    wizardSubmitBtn.disabled = isSubmitting;
    const labelNode = wizardSubmitBtn.querySelector("span");
    if (labelNode && label) labelNode.textContent = label;
  }

  async function submitBookingToApi() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), bookingRequestTimeoutMs);
    let response;
    try {
      response = await fetch(`${bookingApiBase}/api/booking/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBookingPayload()),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("booking_timeout");
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || `booking_submit_${response.status}`);
    }

    localStorage.setItem("black_carp_last_booking", JSON.stringify({
      requestId: data.requestId,
      publicCode: data.publicCode,
      telegramUrl: data.telegramUrl,
      submittedAt: new Date().toISOString()
    }));

    return data;
  }

  function buildBookingPayload() {
    const priceEstimate = estimatePrice(
      wizardState.bodyZone,
      wizardState.bodySubzone,
      wizardState.sizeCm,
      wizardState.sizePreset
    );

    return {
      idempotencyKey: getIdempotencyKey(),
      consentAt: new Date().toISOString(),
      firstTattoo: wizardState.firstTattoo,
      beenToMaster: wizardState.beenToMaster,
      hasSketch: Boolean(wizardState.hasSketch),
      sketchComment: wizardState.sketchComment || "",
      bodyZone: zoneNamesRu[wizardState.bodyZone] || wizardState.bodyZone,
      bodySubzone: getBodySubzoneLabel(),
      bodyView: wizardState.bodyView || "front",
      sizePreset: wizardState.sizePreset,
      sizeCm: wizardState.sizeCm,
      ideaText: wizardState.ideaText || "",
      priceEstimate,
      clientName: wizardState.clientName,
      contactType: wizardState.contactType,
      contactValue: wizardState.contactValue,
      contactComment: wizardState.contactComment,
      attachments: buildBookingAttachments()
    };
  }

  function buildBookingAttachments() {
    const attachments = [];
    if (wizardState.hasSketch && wizardState.sketchData) {
      attachments.push({
        kind: "sketch",
        dataUrl: wizardState.sketchData
      });
    }
    wizardState.referenceImages.slice(0, 3).forEach((dataUrl) => {
      attachments.push({
        kind: "reference",
        dataUrl
      });
    });
    return attachments;
  }

  function getIdempotencyKey() {
    const storageKey = "black_carp_booking_idempotency_key";
    let key = localStorage.getItem(storageKey);
    if (!key) {
      key = `web_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(storageKey, key);
    }
    return key;
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Continue to the synchronous fallback used by older WebViews.
      }
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return Boolean(document.execCommand?.("copy"));
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }

  function fallbackTelegramUrl() {
    return `https://t.me/${bookingBotUsername}?start=${encodeURIComponent(getTelegramCode())}`;
  }

  function compileTextReport() {
    const firstTattooText = wizardState.firstTattoo === "yes" ? "Да" : "Нет";
    const beenToMasterText = wizardState.firstTattoo === "no"
      ? (wizardState.beenToMaster === "yes" ? "Да" : "Нет")
      : "Не применимо";

    const sketchText = wizardState.hasSketch ? "Да" : "Нужна разработка";
    const sideText = wizardState.bodyView === "front" ? "Спереди" : "Сзади";
    const locationText = `${zoneNamesRu[wizardState.bodyZone] || "Не указана"} — ${getBodySubzoneLabel() || "Не указана"} (${sideText})`;
    const contactTypeText = { telegram:"Telegram", phone:"Телефон", other:"Другой" }[wizardState.contactType] || wizardState.contactType;

    return `BLACK CARP — АНКЕТА ЗАПИСИ
------------------------------
• Имя: ${wizardState.clientName || "Не указано"}
• Канал связи: ${contactTypeText || "Не указан"}
• Контакт: ${wizardState.contactValue || "Не указан"}
• Комментарий к контакту: ${wizardState.contactComment || "Нет"}
• Первая татуировка: ${firstTattooText}
• Был(а) у этого мастера: ${beenToMasterText}
• Готовый эскиз: ${sketchText}
• Комментарий к эскизу: ${wizardState.sketchComment || "Нет"}
• Зона нанесения: ${locationText}
• Размер: ${wizardState.sizeCm ? `~${wizardState.sizeCm} см (Пресет ${wizardState.sizePreset})` : "Не выбран"}
• Описание идеи: ${wizardState.ideaText || "Опишет в переписке"}
• Референсов прикреплено: ${wizardState.referenceImages.length}`;
  }

  function getTelegramCode() {
    const subTranslation = subzoneTranslations[wizardState.bodySubzone] || "any";
    return [
      wizardState.firstTattoo === "yes" ? "y" : "n",
      wizardState.beenToMaster === "yes" ? "y" : (wizardState.beenToMaster === "no" ? "n" : "x"),
      wizardState.hasSketch ? "y" : "n",
      wizardState.bodyZone || "any",
      subTranslation,
      wizardState.bodyView === "front" ? "f" : "b",
      wizardState.sizeCm || "na"
    ].join("_");
  }

  renderLuxuryMenu();
  loadStateFromStorage();
}

function saveStateToStorage() {
  try {
    const stateCopy = { ...wizardState };
    // Don't store large image files in local storage to prevent quota errors
    stateCopy.hadSketchFile = Boolean(stateCopy.sketchData);
    stateCopy.referenceImageCount = stateCopy.referenceImages.length || Number(stateCopy.pendingReferenceReattachCount) || 0;
    stateCopy.sketchData = null;
    stateCopy.referenceImages = [];

    localStorage.setItem("black_carp_booking_state", JSON.stringify(stateCopy));
    localStorage.setItem("black_carp_booking_history", JSON.stringify(wizardHistory));
  } catch (e) {
    console.error("Local storage save failed", e);
  }
}

function loadStateFromStorage() {
  try {
    const savedState = localStorage.getItem("black_carp_booking_state");
    const savedHistory = localStorage.getItem("black_carp_booking_history");

    if (savedState && savedHistory) {
      const parsedState = JSON.parse(savedState);
      const missingReferenceCount = Math.max(0, Number(parsedState.referenceImageCount) || 0);

      // Restore values
      Object.assign(wizardState, parsedState);
      wizardState.sizeCm = Number(wizardState.sizeCm) || null;
      wizardState.bodyView = ["front", "back"].includes(wizardState.bodyView) ? wizardState.bodyView : "front";
      if (wizardState.bodyZone === "back") wizardState.bodyView = "back";
      if (wizardState.bodyZone === "torso") wizardState.bodyView = "front";
      wizardState.referenceImages = [];
      const parsedHistory = JSON.parse(savedHistory);
      const allowedSteps = new Set(["2", "3", "4", "4a", "5", "6", "7", "8"]);
      wizardHistory = Array.isArray(parsedHistory)
        ? parsedHistory.filter((step) => allowedSteps.has(String(step)))
        : [2];
      if (!wizardHistory.length) wizardHistory = [2];
      const hadReferenceStep = wizardHistory.some((step) => String(step) === "7");
      wizardState.pendingReferenceReattachCount = missingReferenceCount;

      if (wizardState.hasSketch && !wizardState.sketchData && wizardHistory.some((step) => String(step) === "4a")) {
        const uploadIndex = wizardHistory.findIndex((step) => String(step) === "4a");
        wizardHistory = wizardHistory.slice(0, uploadIndex + 1);
        setTimeout(() => showToast("После обновления добавьте файл эскиза заново."), 0);
      }

      if (missingReferenceCount > 0 && hadReferenceStep) {
        const ideaIndex = wizardHistory.findIndex((step) => String(step) === "7");
        if (ideaIndex >= 0) wizardHistory = wizardHistory.slice(0, ideaIndex + 1);
        if (refRestoreNotice) {
          refRestoreNotice.hidden = false;
          refRestoreNotice.textContent = `После обновления прикрепите ${missingReferenceCount} ${missingReferenceCount === 1 ? "референс" : "референса"} заново или продолжите без них.`;
        }
        setTimeout(() => showToast("Референсы не хранятся в браузере — прикрепите их заново."), 0);
      }

      // Restore UI indicators
      const lastStep = wizardHistory[wizardHistory.length - 1];

      // Update form textareas/options based on saved values
      if (wizardState.ideaText && tattooIdeaText) {
        tattooIdeaText.value = wizardState.ideaText;
      }
      if (wizardState.sketchComment && sketchComment) {
        sketchComment.value = wizardState.sketchComment;
      }
      if (bookingClientName) bookingClientName.value = wizardState.clientName || "";
      if (bookingContactType) bookingContactType.value = wizardState.contactType || "telegram";
      if (bookingContactValue) bookingContactValue.value = wizardState.contactValue || "";
      if (bookingContactComment) bookingContactComment.value = wizardState.contactComment || "";
      if (wizardState.sizeCm) {
        if (sizeSliderVal) sizeSliderVal.textContent = `${wizardState.sizeCm} см`;
        updateSizeVisualizer(wizardState.sizeCm);
      }

      // Sync Front/Back buttons
      syncBodyViewControls();
      if (wizardState.bodyView === "front") {
        if (svgGroupFront) svgGroupFront.style.display = "block";
        if (svgGroupBack) svgGroupBack.style.display = "none";
      } else {
        if (svgGroupFront) svgGroupFront.style.display = "none";
        if (svgGroupBack) svgGroupBack.style.display = "block";
      }

      // Restore option selections in HTML
      restoreSelectionClasses();
      renderLuxuryMenuControl?.();
      if (String(lastStep) === "8") window.renderBlackCarpBookingSummary?.();
      goToSlide(lastStep);
    } else {
      updateProgress(2);
    }
  } catch (e) {
    console.error("Local storage load failed", e);
    updateProgress(2);
  }
}

function restoreSelectionClasses() {
  // Step 2
  if (wizardState.firstTattoo) {
    document.querySelectorAll(".wizard-slide[data-step='2'] .option-card").forEach(c => {
      const selected = c.dataset.value === wizardState.firstTattoo;
      c.classList.toggle("selected", selected);
      c.setAttribute("aria-pressed", String(selected));
    });
  }
  // Step 3
  if (wizardState.beenToMaster) {
    document.querySelectorAll(".wizard-slide[data-step='3'] .option-card").forEach(c => {
      const selected = c.dataset.value === wizardState.beenToMaster;
      c.classList.toggle("selected", selected);
      c.setAttribute("aria-pressed", String(selected));
    });
  }
  // Step 4
  if (wizardState.hasSketch !== null) {
    const val = wizardState.hasSketch ? "yes" : "no";
    document.querySelectorAll(".wizard-slide[data-step='4'] .option-card").forEach(c => {
      const selected = c.dataset.value === val;
      c.classList.toggle("selected", selected);
      c.setAttribute("aria-pressed", String(selected));
    });
  }
  // Step 6 size
  if (wizardState.sizePreset) {
    document.querySelectorAll(".size-preset-card").forEach(c => {
      const selected = c.dataset.sizePreset === wizardState.sizePreset;
      c.classList.toggle("selected", selected);
      c.setAttribute("aria-pressed", String(selected));
    });
    if (sizeNextBtn) {
      const label = sizeNextBtn.querySelector("span");
      if (label) label.textContent = "Продолжить";
    }
  }
}

function updateSizeVisualizer(cm) {
  const visualizerTattooBox = document.getElementById("visualizerTattooBox");
  const visualizerPhoneBox = document.getElementById("visualizerPhoneBox");
  if (!visualizerTattooBox || !visualizerPhoneBox) return;

  const phoneLabel = visualizerPhoneBox.querySelector("span");
  const tattooLabel = visualizerTattooBox.querySelector("span");
  const metrics = getSizeVisualizerMetrics(cm);

  visualizerPhoneBox.style.width = `${metrics.phoneWidth}px`;
  visualizerPhoneBox.style.height = `${metrics.phoneHeight}px`;
  visualizerPhoneBox.style.fontSize = `${metrics.phoneFontSize}px`;
  visualizerTattooBox.style.width = `${metrics.tattooSize}px`;
  visualizerTattooBox.style.height = `${metrics.tattooSize}px`;

  if (phoneLabel) phoneLabel.textContent = "15\u00a0см";
  if (tattooLabel) tattooLabel.textContent = metrics.tattooLabel;
}

function initLocationActions() {
  document.querySelectorAll("[data-copy-address]").forEach((button) => {
    button.addEventListener("click", async () => {
      const address = button.dataset.copyAddress;
      if (!address) return;

      try {
        await navigator.clipboard.writeText(address);
        const originalText = button.textContent;
        button.textContent = "Скопировано";
        button.classList.add("is-copied");
        window.setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove("is-copied");
        }, 1800);
      } catch (error) {
        console.error("Address copy failed", error);
      }
    });
  });
}

// Initialize Wizard on DOM Load
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    initWizard();
    initLocationActions();
  });
} else {
  initWizard();
  initLocationActions();
}
