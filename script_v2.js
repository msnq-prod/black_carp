// CORE LOGIC & ROUTING FOR BLACK CARP V2

const views = [...document.querySelectorAll(".view")];
const navItems = [...document.querySelectorAll(".nav-item")];
const app = document.querySelector("#app");
const worksFeed = document.querySelector("#worksFeed");

const viewTitles = {
  home: "Black Carp — авторская графика",
  works: "Работы — Black Carp",
  booking: "Запись — Black Carp",
  profile: "Профиль — Black Carp"
};

// 8 conceptual works with distinct names, body zones, techniques, and dates to satisfy the spec
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

// Populate works feed dynamically
if (worksFeed) {
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
}

function router() {
  // Redirect to home hash if empty on load
  if (!window.location.hash) {
    window.location.hash = "#/home";
    return;
  }

  const hash = window.location.hash;
  const route = hash.replace("#/", "");
  
  // Verify route exists, fallback to home
  const targetView = document.getElementById(`view-${route}`);
  if (!targetView) {
    window.location.hash = "#/home";
    return;
  }

  // Toggle views
  views.forEach((view) => {
    view.classList.toggle("is-active", view.id === `view-${route}`);
  });

  // Update navigation items
  navItems.forEach((item) => {
    const isActive = item.getAttribute("href") === hash;
    item.classList.toggle("is-active", isActive);
    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });

  // Update page title
  document.title = viewTitles[route] || viewTitles.home;

  // Standard scroll reset - solving P3-01 (behavior: instant fallback)
  if (route === "works") {
    if (worksFeed) worksFeed.scrollTop = 0;
  } else {
    window.scrollTo({ top: 0, behavior: "auto" });
    if (app) app.scrollTop = 0;
  }
}

// Listen to hash changes and initial page load
window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
