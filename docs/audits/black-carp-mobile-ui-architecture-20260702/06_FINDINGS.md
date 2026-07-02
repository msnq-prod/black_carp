# Findings

## P1-01: Screens Are Not Real Pages

- **Promise:** bottom navigation implies four site sections/pages.
- **Reality:** all screens are one document with `display: none/block`; URL never changes.
- **Evidence:** `index.html:17-167`, `script.js:73-96`.
- **Effect:** no deep links, no browser history, reload always returns to home, section state is fragile.
- **Direction:** introduce real route/hash state at minimum; ideally separate page-level routes in the next implementation.
- **Status:** confirmed.

## P1-02: Mobile Navigation Has No Semantic Current State

- **Promise:** active section is clear and accessible.
- **Reality:** active state is only `.is-active`; no `aria-current`, no page title update.
- **Evidence:** `index.html:169-193`, `script.js:78-80`.
- **Effect:** screen readers and browser semantics do not know which section is current.
- **Direction:** active nav must update semantic state, route/hash, and page title.
- **Status:** confirmed.

## P1-03: Font System Is Not Production-Locked

- **Promise:** typography is the main decorative tool.
- **Reality:** `Inter` and `Cormorant Garamond` are referenced but not loaded; rendering depends on local OS fonts.
- **Evidence:** `styles.css:10-11`; no font import or `@font-face`.
- **Effect:** on Android or another browser the site can fall back to generic system/Times-like typography and lose the intended premium feel.
- **Direction:** choose and ship actual fonts; define stable fallbacks only after that.
- **Status:** confirmed.

## P2-01: Icon Semantics Are Wrong

- **Promise:** icons should clarify navigation.
- **Reality:** "Работы" uses a grid icon while the section is fullscreen swipe/scroll; "Запись" uses a calendar icon while MVP has no calendar booking.
- **Evidence:** `index.html:176-185`.
- **Effect:** UI quietly promises wrong interaction models.
- **Direction:** use icons that match actual behavior: gallery/viewer for works, Telegram/message/consultation for booking.
- **Status:** confirmed.

## P2-02: Bottom Nav Is Too Small And Uneven

- **Promise:** key controls are thumb-accessible and premium.
- **Reality:** measured inactive nav buttons are 40px high on mobile; active button becomes 50px because of the dot. Font is 10px.
- **Evidence:** `styles.css:527-573`; browser check at 320/390/430px.
- **Effect:** nav feels cramped and uneven, closer to a prototype tab bar than a finished mobile surface.
- **Direction:** set stable button dimensions, larger hit area, and one consistent selected-state system.
- **Status:** confirmed.

## P2-03: Focus State Was Visually Weakened

- **Promise:** controls remain accessible and polished.
- **Reality:** nav focus outline is removed and replaced with underline on a 10px label.
- **Evidence:** `styles.css:543-550`.
- **Effect:** keyboard/focus state is too weak and can disappear in the dark UI.
- **Direction:** design a quiet but visible focus state consistent with the brand.
- **Status:** confirmed.

## P2-04: Global Grain Dirties Interface Text

- **Promise:** subtle matte texture.
- **Reality:** `.grain` is fixed at `z-index: 30`, above nav and content; nav is `z-index: 20`.
- **Evidence:** `styles.css:62-72`, `styles.css:510-524`.
- **Effect:** texture sits on top of text/icons, making UI look noisy and less expensive.
- **Direction:** apply grain to background/media layers, not over functional UI.
- **Status:** confirmed.

## P2-05: Scroll Model Is Inconsistent

- **Promise:** mobile app-like navigation.
- **Reality:** Home/Profile use page scroll; Works uses internal `.works-feed` scroll; scrollbars are hidden globally.
- **Evidence:** `styles.css:18-40`, `styles.css:351-360`, `script.js:82-87`.
- **Effect:** gesture behavior changes between screens and users get no scroll affordance.
- **Direction:** choose one mobile scroll model per screen type and keep it legible.
- **Status:** confirmed.

## P2-06: Typography Reuses One Formula Across Different Screens

- **Promise:** editorial rhythm with page-specific hierarchy.
- **Reality:** unrelated headings share the same grouped CSS rule.
- **Evidence:** `styles.css:234-244`, `styles.css:478-480`.
- **Effect:** screens feel templated; the site loses authored editorial pacing.
- **Direction:** define page-level type roles: hero, artwork title, editorial statement, utility screen title, nav label.
- **Status:** confirmed.

## P2-07: Heading Hierarchy Is Not Page-Aware

- **Promise:** each section works as a meaningful page.
- **Reality:** only Home has `h1`; Works/Profile use lower-level headings or labels despite acting as pages.
- **Evidence:** `index.html:35`, `script.js:64-66`, `index.html:141`.
- **Effect:** semantics and structure do not match navigation.
- **Direction:** each route/screen needs a page-level heading, visible or visually hidden.
- **Status:** confirmed.

## P3-01: Nonstandard Scroll Behavior Value

- **Promise:** reliable section reset on nav.
- **Reality:** `behavior: "instant"` is not standard ScrollTo behavior.
- **Evidence:** `script.js:82-87`.
- **Effect:** some browsers may ignore it or behave inconsistently.
- **Direction:** use `auto` or direct scroll assignment.
- **Status:** confirmed.

