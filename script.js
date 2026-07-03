const views = [...document.querySelectorAll(".view")];
const navButtons = [...document.querySelectorAll("[data-nav]")];
const openButtons = [...document.querySelectorAll("[data-open-view]")];
const app = document.querySelector("#app");
const worksFeed = document.querySelector("#worksFeed");
const worksTopButton = document.querySelector("#worksTopButton");
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
const viewTitles = {
  home: "Black Carp — авторская графика",
  works: "Работы — Black Carp",
  booking: "Запись — Black Carp",
  profile: "Профиль — Black Carp"
};

const works = [
  {
    title: "Nocturne I",
    meta: "forearm / graphic / 2026",
    image: "assets/media/hero-forearm.png",
    alt: "Графическая татуировка на предплечье"
  },
  {
    title: "Arc Study",
    meta: "back / graphic / 2026",
    image: "assets/media/work-shoulder.png",
    alt: "Графическая татуировка на спине"
  },
  {
    title: "Quiet Line",
    meta: "arm detail / fine line / 2026",
    image: "assets/media/work-detail.png",
    alt: "Макро-фрагмент графической татуировки"
  },
  {
    title: "Paper Trace",
    meta: "sketch / process / 2026",
    image: "assets/media/sketch-process.png",
    alt: "Эскиз графической татуировки на бумаге"
  },
  {
    title: "Axis",
    meta: "forearm / graphic / 2025",
    image: "assets/media/hero-forearm.png",
    alt: "Графическая татуировка на предплечье"
  },
  {
    title: "Shoulder Field",
    meta: "shoulder / graphic / 2025",
    image: "assets/media/work-shoulder.png",
    alt: "Графическая татуировка на плече"
  },
  {
    title: "Skin Map",
    meta: "detail / dotwork / 2026",
    image: "assets/media/work-detail.png",
    alt: "Деталь татуировки на коже"
  },
  {
    title: "Draft 04",
    meta: "paper / composition / 2026",
    image: "assets/media/sketch-process.png",
    alt: "Процесс работы с эскизом"
  }
];

worksFeed.innerHTML = works
  .map(
    (work, index) => `
      <article class="work-slide">
        <img src="${work.image}" alt="${work.alt}" loading="${index === 0 ? "eager" : "lazy"}" />
        <div class="slide-index">${String(index + 1).padStart(2, "0")} / ${String(works.length).padStart(2, "0")}</div>
        <div class="slide-caption">
          <h2>${work.title}</h2>
          <p>${work.meta}</p>
        </div>
      </article>
    `
  )
  .join("");

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
  } else {
    app.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.nav));
});

openButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.openView));
});

if (worksTopButton && worksFeed) {
  worksTopButton.addEventListener("click", () => {
    worksFeed.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function openRouteModal() {
  if (!routeModal) return;
  routeModal.hidden = false;
  routeModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeRouteModal() {
  if (!routeModal) return;
  routeModal.hidden = true;
  routeModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

routeOpenButtons.forEach((button) => {
  button.addEventListener("click", openRouteModal);
});

routeCloseButtons.forEach((button) => {
  button.addEventListener("click", closeRouteModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && routeModal && !routeModal.hidden) {
    closeRouteModal();
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
  referenceImages: []
};

let wizardHistory = [2];

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
const tattooIdeaText = document.getElementById("tattooIdeaText");
const ideaNextBtn = document.getElementById("ideaNextBtn");
const wizardSummaryCard = document.getElementById("wizardSummaryCard");
const wizardPriceEstimate = document.getElementById("wizardPriceEstimate");
const wizardSubmitBtn = document.getElementById("wizardSubmitBtn");
const wizardRestartBtn = document.getElementById("wizardRestartBtn");
const wizardToast = document.getElementById("wizardToast");
const bookingConsent = document.getElementById("bookingConsent");

// Compression utility
function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
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
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
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
  saveStateToStorage();
}

function nextStep(target) {
  wizardHistory.push(target);
  goToSlide(target);
}

function prevStep() {
  if (wizardHistory.length > 1) {
    wizardHistory.pop();
    const target = wizardHistory[wizardHistory.length - 1];
    goToSlide(target);
  }
}

// Reset Wizard
function resetWizard() {
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

  wizardHistory = [2];

  // UI Resets
  document.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));
  document.querySelectorAll(".size-preset-card").forEach(c => c.classList.remove("selected"));

  if (sketchPreviewImg) sketchPreviewImg.src = "";
  if (sketchUploader) {
    sketchUploader.querySelector(".uploader-zone").style.display = "flex";
    sketchUploader.querySelector(".uploader-preview").style.display = "none";
  }
  if (sketchComment) sketchComment.value = "";
  if (refPreviewsContainer) {
    refPreviewsContainer.innerHTML = "";
    refPreviewsContainer.style.display = "none";
  }
  if (tattooIdeaText) tattooIdeaText.value = "";
  if (sizeSliderVal) sizeSliderVal.textContent = "";
  updateSizeVisualizer(null);
  if (sizeNextBtn) {
    const label = sizeNextBtn.querySelector("span");
    if (label) label.textContent = "Продолжить без размера";
  }
  if (bookingConsent) bookingConsent.checked = false;

  resetBodySilhouette();
  localStorage.removeItem("black_carp_booking_idempotency_key");
  localStorage.removeItem("black_carp_last_booking");
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

  // Option Cards
  document.querySelectorAll(".wizard-slide[data-step='2'] .option-card").forEach(card => {
    card.addEventListener("click", () => {
      const val = card.dataset.value;
      wizardState.firstTattoo = val;

      document.querySelectorAll(".wizard-slide[data-step='2'] .option-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");

      setTimeout(() => {
        const next = card.dataset.next;
        nextStep(next);
      }, 250);
    });
  });

  document.querySelectorAll(".wizard-slide[data-step='3'] .option-card").forEach(card => {
    card.addEventListener("click", () => {
      const val = card.dataset.value;
      wizardState.beenToMaster = val;

      document.querySelectorAll(".wizard-slide[data-step='3'] .option-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");

      setTimeout(() => {
        const next = card.dataset.next;
        nextStep(next);
      }, 250);
    });
  });

  document.querySelectorAll(".wizard-slide[data-step='4'] .option-card").forEach(card => {
    card.addEventListener("click", () => {
      const val = card.dataset.value;
      wizardState.hasSketch = (val === "yes");

      document.querySelectorAll(".wizard-slide[data-step='4'] .option-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");

      setTimeout(() => {
        const next = card.dataset.next;
        nextStep(next);
      }, 250);
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
    wizardRestartBtn.addEventListener("click", () => {
      if (confirm("Вы уверены, что хотите сбросить анкету и начать заново?")) {
        resetWizard();
      }
    });
  }

  // File Upload 1 (Sketch)
  if (sketchUploader && sketchInput) {
    sketchUploader.addEventListener("click", (e) => {
      if (!e.target.closest(".btn-remove-file")) {
        sketchInput.click();
      }
    });

    sketchInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        compressImage(file, (base64) => {
          wizardState.sketchData = base64;
          if (sketchPreviewImg) sketchPreviewImg.src = base64;
          sketchUploader.querySelector(".uploader-zone").style.display = "none";
          sketchUploader.querySelector(".uploader-preview").style.display = "flex";
        });
      }
    });
  }

  if (btnRemoveSketch) {
    btnRemoveSketch.addEventListener("click", (e) => {
      e.stopPropagation();
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
      const currentCount = wizardState.referenceImages.length;
      const allowed = maxRefs - currentCount;

      files.slice(0, allowed).forEach(file => {
        compressImage(file, (base64) => {
          wizardState.referenceImages.push(base64);
          renderRefPreviews();
        });
      });
    });
  }

  function renderRefPreviews() {
    if (!refPreviewsContainer) return;
    if (wizardState.referenceImages.length > 0) {
      refPreviewsContainer.style.display = "grid";
      refPreviewsContainer.innerHTML = wizardState.referenceImages.map((img, idx) => `
        <div class="uploader-preview-item">
          <img src="${img}" alt="Референс ${idx + 1}">
          <button type="button" class="btn-remove-item" data-index="${idx}">
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
        });
      });
    } else {
      refPreviewsContainer.style.display = "none";
      refPreviewsContainer.innerHTML = "";
    }
  }

  if (ideaNextBtn) {
    ideaNextBtn.addEventListener("click", () => {
      if (tattooIdeaText) wizardState.ideaText = tattooIdeaText.value;
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
      zoneBtn.innerHTML = `<span>${zoneName}</span><svg class="chevron" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>`;

      const subzoneContainer = document.createElement("div");
      subzoneContainer.className = "luxury-subzones-container";
      if (wizardState.bodyZone === zone) {
        subzoneContainer.style.display = "grid";
      } else {
        subzoneContainer.style.display = "none";
      }

      subzones.forEach(sz => {
        const szBtn = document.createElement("button");
        szBtn.type = "button";
        szBtn.className = `luxury-subzone-btn ${wizardState.bodySubzone === sz ? "selected" : ""}`;
        szBtn.textContent = sz;
        szBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          wizardState.bodyZone = zone;
          wizardState.bodySubzone = sz;
          wizardState.bodySubzoneCustom = "";

          document.querySelectorAll(".luxury-subzone-btn").forEach(b => b.classList.remove("selected"));
          szBtn.classList.add("selected");

          setTimeout(() => nextStep(6), 300);
        });
        subzoneContainer.appendChild(szBtn);
      });

      if (zone === "other") {
        const customWrap = document.createElement("div");
        customWrap.className = "luxury-subzone-custom visible";

        const customInput = document.createElement("input");
        customInput.type = "text";
        customInput.id = "luxurySubzoneCustomInput";
        customInput.className = "luxury-subzone-custom-input";
        customInput.placeholder = "свой вариант";
        customInput.value = wizardState.bodySubzoneCustom || "";
        customInput.maxLength = 80;

        customInput.addEventListener("click", (e) => e.stopPropagation());
        customInput.addEventListener("focus", () => {
          wizardState.bodyZone = "other";
          wizardState.bodySubzone = "Другое";
          zoneBtn.classList.add("active");
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
            const value = customInput.value.trim();
            if (!value) return;
            wizardState.bodyZone = "other";
            wizardState.bodySubzone = "Другое";
            wizardState.bodySubzoneCustom = value;
            nextStep(6);
          }
        });
        customInput.addEventListener("blur", () => {
          wizardState.bodySubzoneCustom = customInput.value.trim();
        });

        customWrap.appendChild(customInput);
        subzoneContainer.appendChild(customWrap);
      }

      zoneBtn.addEventListener("click", () => {
        // Toggle accordion
        const isActive = wizardState.bodyZone === zone;

        // Close all others
        document.querySelectorAll(".luxury-zone-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".luxury-subzones-container").forEach(c => c.style.display = "none");

        if (!isActive) {
          wizardState.bodyZone = zone;
          wizardState.bodySubzone = null;
          wizardState.bodySubzoneCustom = "";
          zoneBtn.classList.add("active");
          subzoneContainer.style.display = "grid";
        } else {
          wizardState.bodyZone = null;
          wizardState.bodySubzone = null;
        }
      });

      zoneGroup.appendChild(zoneBtn);
      zoneGroup.appendChild(subzoneContainer);
      luxuryBodyMenu.appendChild(zoneGroup);
    });
  }

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

      document.querySelectorAll(".size-preset-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");

      // Adjust slider
      let sizeCm = 15;
      if (preset === "XS") sizeCm = 5;
      else if (preset === "S") sizeCm = 10;
      else if (preset === "M") sizeCm = 15;
      else if (preset === "L") sizeCm = 20;
      else if (preset === "XL") sizeCm = 30;

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

  function updateSizeVisualizer(cm) {
    const visualizerTattooBox = document.getElementById("visualizerTattooBox");
    const visualizerPhoneBox = document.getElementById("visualizerPhoneBox");
    if (!visualizerTattooBox || !visualizerPhoneBox) return;
    if (!cm) {
      visualizerPhoneBox.style.width = "76px";
      visualizerPhoneBox.style.height = "132px";
      visualizerPhoneBox.querySelector("span").textContent = "15 см";
      visualizerTattooBox.style.width = "44px";
      visualizerTattooBox.style.height = "44px";
      visualizerTattooBox.querySelector("span").textContent = "";
      return;
    }
    const maxCm = Math.max(15, cm);
    const maxPx = 132;
    const phoneHeight = Math.round((15 / maxCm) * maxPx);
    const tattooSize = Math.round((cm / maxCm) * maxPx);
    visualizerPhoneBox.style.height = `${phoneHeight}px`;
    visualizerPhoneBox.style.width = `${Math.round(phoneHeight * 0.58)}px`;
    visualizerPhoneBox.querySelector("span").textContent = "15 см";
    visualizerTattooBox.style.width = `${tattooSize}px`;
    visualizerTattooBox.style.height = `${tattooSize}px`;
    visualizerTattooBox.querySelector("span").textContent = `${cm} см`;
  }

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
        <span class="summary-value">${experienceText}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Свой эскиз:</span>
        <span class="summary-value">${sketchText}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Зона тела:</span>
        <span class="summary-value">${locationText}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Размер:</span>
        <span class="summary-value">${sizeText}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Идея:</span>
        <span class="summary-value">${ideaTextShort}</span>
      </div>
    `;

    // Estimate price
    const est = estimatePrice(wizardState.bodyZone, wizardState.bodySubzone, wizardState.sizeCm, wizardState.sizePreset);
    if (wizardPriceEstimate) wizardPriceEstimate.textContent = est;
  }

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
      if (!bookingConsent?.checked) {
        showToast("Подтвердите согласие на отправку анкеты.");
        return;
      }

      const textReport = compileTextReport();
      const originalLabel = wizardSubmitBtn.querySelector("span")?.textContent || "Перейти в Telegram";
      setSubmitState(true, "Отправляем анкету");

      try {
        const result = await submitBookingToApi();
        await copyToClipboard(textReport);
        showToast(result.masterNotified
          ? "Анкета отправлена мастеру. Открываем Telegram..."
          : "Анкета сохранена. Открываем Telegram..."
        );
        setTimeout(() => {
          window.open(result.telegramUrl, "_blank");
          setSubmitState(false, originalLabel);
        }, 900);
      } catch (err) {
        console.error("Booking submit failed: ", err);
        await copyToClipboard(textReport);
        showToast("Не удалось отправить на сервер. Анкета скопирована.");
        setTimeout(() => {
          window.open(fallbackTelegramUrl(), "_blank");
          setSubmitState(false, originalLabel);
        }, 1200);
      }
    });
  }

  function setSubmitState(isSubmitting, label) {
    if (!wizardSubmitBtn) return;
    wizardSubmitBtn.disabled = isSubmitting;
    const labelNode = wizardSubmitBtn.querySelector("span");
    if (labelNode && label) labelNode.textContent = label;
  }

  async function submitBookingToApi() {
    const response = await fetch(`${bookingApiBase}/api/booking/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBookingPayload())
    });
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.ok || !data.telegramUrl) {
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
      attachments: buildBookingAttachments()
    };
  }

  function buildBookingAttachments() {
    const attachments = [];
    if (wizardState.sketchData) {
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
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Clipboard copy failed: ", err);
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

    return `BLACK CARP — АНКЕТА ЗАПИСИ
------------------------------
• Первая татуировка: ${firstTattooText}
• Был(а) у этого мастера: ${beenToMasterText}
• Готовый эскиз: ${sketchText}
• Зона нанесения: ${locationText}
• Размер: ${wizardState.sizeCm ? `~${wizardState.sizeCm} см (Пресет ${wizardState.sizePreset})` : "Не выбран"}
• Описание идеи: ${wizardState.ideaText || "Опишет в переписке"}`;
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

  function showToast(msg) {
    if (!wizardToast) return;
    wizardToast.querySelector(".toast-message").textContent = msg;
    wizardToast.style.display = "flex";
    setTimeout(() => {
      wizardToast.style.animation = "none";
      setTimeout(() => {
        wizardToast.style.display = "none";
      }, 500);
    }, 2800);
  }

  try {
    localStorage.removeItem("black_carp_booking_state");
    localStorage.removeItem("black_carp_booking_history");
  } catch (e) {
    console.error("Local storage reset failed", e);
  }
  updateProgress(2);
  renderLuxuryMenu();
}

function saveStateToStorage() {
  try {
    const stateCopy = { ...wizardState };
    // Don't store large image files in local storage to prevent quota errors
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

      // Restore values
      Object.assign(wizardState, parsedState);
      wizardState.sizeCm = Number(wizardState.sizeCm) || null;
      wizardHistory = [2];

      // Restore UI indicators
      const lastStep = 2;

      // Update form textareas/options based on saved values
      if (wizardState.ideaText && tattooIdeaText) {
        tattooIdeaText.value = wizardState.ideaText;
      }
      if (wizardState.sketchComment && sketchComment) {
        sketchComment.value = wizardState.sketchComment;
      }
      if (wizardState.sizeCm) {
        if (sizeSliderVal) sizeSliderVal.textContent = `${wizardState.sizeCm} см`;
        updateSizeVisualizer(wizardState.sizeCm);
      }

      // Sync Front/Back buttons
      document.querySelectorAll(".map-view-toggle").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.view === wizardState.bodyView);
      });
      if (wizardState.bodyView === "front") {
        if (svgGroupFront) svgGroupFront.style.display = "block";
        if (svgGroupBack) svgGroupBack.style.display = "none";
      } else {
        if (svgGroupFront) svgGroupFront.style.display = "none";
        if (svgGroupBack) svgGroupBack.style.display = "block";
      }

      // Restore option selections in HTML
      restoreSelectionClasses();
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
      c.classList.toggle("selected", c.dataset.value === wizardState.firstTattoo);
    });
  }
  // Step 3
  if (wizardState.beenToMaster) {
    document.querySelectorAll(".wizard-slide[data-step='3'] .option-card").forEach(c => {
      c.classList.toggle("selected", c.dataset.value === wizardState.beenToMaster);
    });
  }
  // Step 4
  if (wizardState.hasSketch !== null) {
    const val = wizardState.hasSketch ? "yes" : "no";
    document.querySelectorAll(".wizard-slide[data-step='4'] .option-card").forEach(c => {
      c.classList.toggle("selected", c.dataset.value === val);
    });
  }
  // Step 6 size
  if (wizardState.sizePreset) {
    document.querySelectorAll(".size-preset-card").forEach(c => {
      c.classList.toggle("selected", c.dataset.sizePreset === wizardState.sizePreset);
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
  if (visualizerTattooBox && visualizerPhoneBox) {
    if (!cm) {
      visualizerPhoneBox.style.width = "76px";
      visualizerPhoneBox.style.height = "132px";
      visualizerPhoneBox.querySelector("span").textContent = "15 см";
      visualizerTattooBox.style.width = "44px";
      visualizerTattooBox.style.height = "44px";
      visualizerTattooBox.querySelector("span").textContent = "";
      return;
    }
    const maxCm = Math.max(15, cm);
    const maxPx = 132;
    const phoneHeight = Math.round((15 / maxCm) * maxPx);
    const tattooSize = Math.round((cm / maxCm) * maxPx);
    visualizerPhoneBox.style.height = `${phoneHeight}px`;
    visualizerPhoneBox.style.width = `${Math.round(phoneHeight * 0.58)}px`;
    visualizerPhoneBox.querySelector("span").textContent = "15 см";
    visualizerTattooBox.style.width = `${tattooSize}px`;
    visualizerTattooBox.style.height = `${tattooSize}px`;
    visualizerTattooBox.querySelector("span").textContent = `${cm} см`;
  }
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
