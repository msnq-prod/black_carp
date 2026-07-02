const views = [...document.querySelectorAll(".view")];
const navButtons = [...document.querySelectorAll("[data-nav]")];
const openButtons = [...document.querySelectorAll("[data-open-view]")];
const app = document.querySelector("#app");
const worksFeed = document.querySelector("#worksFeed");
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
  bodyView: "front",
  sizePreset: null,
  sizeCm: 15,
  ideaText: "",
  referenceImages: []
};

let wizardHistory = [1];

const subzonesData = {
  head: ["Шея", "За ухом", "Голова"],
  torso: ["Грудь", "Ключицы", "Ребра", "Живот"],
  back: ["Лопатки", "Поясница", "Вдоль позвоночника", "Вся спина"],
  arms: ["Плечо", "Предплечье", "Бицепс", "Кисть", "Рукав"],
  legs: ["Бедро", "Икра / Голень", "Колено", "Лодыжка", "Штанина"]
};

const zoneNamesRu = {
  head: "Голова и Шея",
  torso: "Грудь и Живот",
  back: "Спина",
  arms: "Руки",
  legs: "Ноги"
};

const subzoneTranslations = {
  "Шея": "neck", "За ухом": "behindear", "Голова": "head",
  "Грудь": "chest", "Ключицы": "collarbone", "Ребра": "ribs", "Живот": "stomach",
  "Лопатки": "shoulderblades", "Поясница": "lowerback", "Вдоль позвоночника": "spine", "Вся спина": "fullback",
  "Плечо": "shoulder", "Предплечье": "forearm", "Бицепс": "biceps", "Кисть": "wrist", "Рукав": "sleeve",
  "Бедро": "thigh", "Икра / Голень": "calfshin", "Колено": "knee", "Лодыжка": "ankle", "Штанина": "leg"
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
const sizeRangeInput = document.getElementById("sizeRangeInput");
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

// Progress map step percentages
const progressMap = {
  "1": 12.5,
  "2": 25,
  "3": 37.5,
  "4": 50,
  "4a": 55,
  "5": 62.5,
  "6": 75,
  "7": 87.5,
  "8": 100
};

// Render progress
function updateProgress(step) {
  if (!wizardProgress) return;
  const pct = progressMap[step] || 0;
  wizardProgress.style.width = `${pct}%`;
  
  // Format visual indicators
  let stepIndex = wizardHistory.length;
  if (wizardStepIndicator) {
    wizardStepIndicator.textContent = `Шаг ${stepIndex} из 8`;
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
    const totalDots = 8;
    let dotsHtml = "";
    for (let i = 1; i <= totalDots; i++) {
      const isActive = i === stepIndex;
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
  wizardState.bodyView = "front";
  wizardState.sizePreset = null;
  wizardState.sizeCm = 15;
  wizardState.ideaText = "";
  wizardState.referenceImages = [];

  wizardHistory = [1];

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
  if (sizeRangeInput) sizeRangeInput.value = 15;
  if (sizeSliderVal) sizeSliderVal.textContent = "15 см";
  if (sizeNextBtn) sizeNextBtn.setAttribute("disabled", "true");

  resetBodySilhouette();
  goToSlide(1);
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

  // Front/Back Body Map toggles
  document.querySelectorAll(".map-view-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      wizardState.bodyView = view;

      document.querySelectorAll(".map-view-toggle").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const imgFront = document.getElementById("imgFront");
      const imgBack = document.getElementById("imgBack");
      
      if (view === "front") {
        if (svgGroupFront) svgGroupFront.style.display = "block";
        if (svgGroupBack) svgGroupBack.style.display = "none";
        if (imgFront) imgFront.style.display = "block";
        if (imgBack) imgBack.style.display = "none";
      } else {
        if (svgGroupFront) svgGroupFront.style.display = "none";
        if (svgGroupBack) svgGroupBack.style.display = "block";
        if (imgFront) imgFront.style.display = "none";
        if (imgBack) imgBack.style.display = "block";
      }
      resetBodySilhouette();
    });
  });

  // SVG interactions
  document.querySelectorAll(".body-zone").forEach(zoneEl => {
    zoneEl.addEventListener("click", () => {
      const zone = zoneEl.dataset.zone;
      wizardState.bodyZone = zone;

      // Reset prior active zone paths
      document.querySelectorAll(".body-zone").forEach(z => z.classList.remove("active-zone"));
      
      // Highlight paths of selected zone
      const visibleSelector = wizardState.bodyView === "front" ? "#svgGroupFront" : "#svgGroupBack";
      document.querySelectorAll(`${visibleSelector} [data-zone='${zone}']`).forEach(p => p.classList.add("active-zone"));

      // Zoom silhouette SVG
      const zoomConfig = svgZoomStyles[zone] || { scale: 1, origin: "50% 50%" };
      if (bodySilhouetteContainer) {
        bodySilhouetteContainer.style.transformOrigin = zoomConfig.origin;
        bodySilhouetteContainer.style.transform = `scale(${zoomConfig.scale})`;
      }
      // Add selection layout class
      const container = document.querySelector(".body-map-container");
      if (container) container.classList.add("zone-selected");

      // Show subzones panel
      if (selectedZoneName) selectedZoneName.textContent = zoneNamesRu[zone] || "Зона";
      renderSubzones(zone);
    });
  });

  if (btnBackToSilhouette) {
    btnBackToSilhouette.addEventListener("click", resetBodySilhouette);
  }

  function renderSubzones(zone) {
    if (!subzonesPanel || !subzonesList) return;
    const subzones = subzonesData[zone] || [];
    subzonesList.innerHTML = subzones.map(subzone => `
      <button type="button" class="subzone-btn ${wizardState.bodySubzone === subzone ? "selected" : ""}" data-subzone="${subzone}">
        ${subzone}
      </button>
    `).join("");

    // Bind subzone clicks
    subzonesList.querySelectorAll(".subzone-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const subzone = btn.dataset.subzone;
        wizardState.bodySubzone = subzone;

        subzonesList.querySelectorAll(".subzone-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");

        // Advance to next step after a tiny delay
        setTimeout(() => {
          nextStep(6);
        }, 220);
      });
    });
  }

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
      if (sizeRangeInput) {
        sizeRangeInput.value = sizeCm;
      }
      if (sizeSliderVal) {
        sizeSliderVal.textContent = `${sizeCm} см`;
      }

      updateSizeVisualizer(sizeCm);
      if (sizeNextBtn) {
        sizeNextBtn.removeAttribute("disabled");
      }
    });
  });

  // Size Slider Input
  if (sizeRangeInput) {
    sizeRangeInput.addEventListener("input", (e) => {
      const size = parseInt(e.target.value);
      wizardState.sizeCm = size;
      if (sizeSliderVal) {
        sizeSliderVal.textContent = `${size} см`;
      }

      // Highlight closest preset
      let activePreset = "M";
      if (size <= 5) activePreset = "XS";
      else if (size <= 10) activePreset = "S";
      else if (size <= 15) activePreset = "M";
      else if (size <= 22) activePreset = "L";
      else activePreset = "XL";

      wizardState.sizePreset = activePreset;
      document.querySelectorAll(".size-preset-card").forEach(c => {
        c.classList.toggle("selected", c.dataset.sizePreset === activePreset);
      });

      updateSizeVisualizer(size);
      if (sizeNextBtn) {
        sizeNextBtn.removeAttribute("disabled");
      }
    });
  }

  function updateSizeVisualizer(cm) {
    const visualizerTattooBox = document.getElementById("visualizerTattooBox");
    if (!visualizerTattooBox) return;
    const sizePx = Math.max(12, Math.min(160, cm * 5.33));
    visualizerTattooBox.style.width = `${sizePx}px`;
    visualizerTattooBox.style.height = `${sizePx}px`;
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
    const subzoneText = wizardState.bodySubzone || "Не выбрано";
    const locationText = `${zoneNameText} — ${subzoneText} (${sideText})`;

    const sizeText = `${wizardState.sizeCm} см (Пресет ${wizardState.sizePreset})`;

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
    if (sizePreset === "XL" || sizeCm >= 25) {
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
    wizardSubmitBtn.addEventListener("click", () => {
      const textReport = compileTextReport();
      
      // Copy report to clipboard
      navigator.clipboard.writeText(textReport).then(() => {
        showToast("Анкета скопирована! Открываем Telegram...");
        
        // Compute short Telegram deep link param
        const code = getTelegramCode();
        const tgLink = `https://t.me/blackcarp_bot?start=${code}`;
        
        setTimeout(() => {
          window.open(tgLink, "_blank");
        }, 1200);
      }).catch(err => {
        console.error("Clipboard copy failed: ", err);
        // Fallback: just open link
        const code = getTelegramCode();
        window.open(`https://t.me/blackcarp_bot?start=${code}`, "_blank");
      });
    });
  }

  function compileTextReport() {
    const firstTattooText = wizardState.firstTattoo === "yes" ? "Да" : "Нет";
    const beenToMasterText = wizardState.firstTattoo === "no"
      ? (wizardState.beenToMaster === "yes" ? "Да" : "Нет")
      : "Не применимо";
    
    const sketchText = wizardState.hasSketch ? "Да" : "Нужна разработка";
    const sideText = wizardState.bodyView === "front" ? "Спереди" : "Сзади";
    const locationText = `${zoneNamesRu[wizardState.bodyZone] || "Не указана"} — ${wizardState.bodySubzone || "Не указана"} (${sideText})`;
    
    return `BLACK CARP — АНКЕТА ЗАПИСИ
------------------------------
• Первая татуировка: ${firstTattooText}
• Был(а) у этого мастера: ${beenToMasterText}
• Готовый эскиз: ${sketchText}
• Зона нанесения: ${locationText}
• Размер: ~${wizardState.sizeCm} см (Пресет ${wizardState.sizePreset || "M"})
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
      wizardState.sizeCm || 15
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

  // Storage recovery
  loadStateFromStorage();
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
      const parsedHistory = JSON.parse(savedHistory);

      // Restore values
      Object.assign(wizardState, parsedState);
      wizardHistory = parsedHistory;

      // Restore UI indicators
      const lastStep = wizardHistory[wizardHistory.length - 1];
      
      // Update form textareas/options based on saved values
      if (wizardState.ideaText && tattooIdeaText) {
        tattooIdeaText.value = wizardState.ideaText;
      }
      if (wizardState.sketchComment && sketchComment) {
        sketchComment.value = wizardState.sketchComment;
      }
      if (wizardState.sizeCm) {
        if (sizeRangeInput) sizeRangeInput.value = wizardState.sizeCm;
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
      updateProgress(1);
    }
  } catch (e) {
    console.error("Local storage load failed", e);
    updateProgress(1);
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
    if (sizeNextBtn) sizeNextBtn.removeAttribute("disabled");
  }
}

function updateSizeVisualizer(cm) {
  const visualizerTattooBox = document.getElementById("visualizerTattooBox");
  if (visualizerTattooBox) {
    const sizePx = Math.max(12, Math.min(160, cm * 5.33));
    visualizerTattooBox.style.width = `${sizePx}px`;
    visualizerTattooBox.style.height = `${sizePx}px`;
    visualizerTattooBox.querySelector("span").textContent = `${cm} см`;
  }
}

// Initialize Wizard on DOM Load
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", () => {
    initWizard();
  });
} else {
  initWizard();
}

