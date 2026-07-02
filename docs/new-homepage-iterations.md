# Black Carp — New Homepage Iterations & Observations

This document logs the evaluation iterations of the new homepage (`index_v2.html`, `styles_v2.css`, `script_v2.js`) against the project specification (`docs/black-carp-mvp.md`) and previous audit findings.

---

## Iteration 1: Initial Implementation (Baseline)

### Overview
The first pass established a clean mobile-first boilerplate (`index_v2.html`), modern styles (`styles_v2.css`), and hash-based routing (`script_v2.js`). 

### Checklist vs. MVP Specification (docs/black-carp-mvp.md)

1. **First Screen (Hero Scene)**:
   - [x] Vertical looped video (`assets/media/hero-video.mp4`) with poster fallback.
   - [x] Title "BLACK CARP" in serif typography.
   - [x] Subtitle "Авторская графика · Хабаровск" with proper line spacing.
   - [x] Booking CTA button linking to `#/booking`.
   - [x] Bottom navigation is fixed and active section matches current screen.
   - *Observation*: The first screen fully meets the requirements and looks clean.

2. **Home Page Content Flow**:
   - [x] Strong work fragment (featured images).
   - [ ] Selected works gallery (Izbrannye raboty) — *Missing: Currently, we only have editorial images and no dedicated visual carousel/gallery of selected works on the Home screen.*
   - [x] Master's approach description — *Partially present in editorial captions, but lacks a dedicated narrative statement about the craft philosophy.*
   - [x] Pricing statement: "Авторские работы — от 7 000 ₽".
   - [x] Repeated Telegram transition button.
   - [ ] Compact information block: consultation, preparation, contraindications, aftercare — *Partially present as a generic list, but lacks actual information about preparation, contraindications, and aftercare (referred to as "discussed personally").*

3. **Visual & Structural System (P1-01 to P3-01 Audits)**:
   - [x] Hash-based routing enables deep links and browser history.
   - [x] Accessibility elements updated (proper headers, `aria-current="page"`).
   - [x] Real Google Fonts (`Cormorant Garamond` and `Inter`) loaded and displayed.
   - [x] Bottom navigation hit areas enlarged to 76px height (touch target > 48px), and icons updated (Gallery frame for works, Message bubble for booking).
   - [x] Grain overlay placed behind text content (`z-index: 1`) to keep text crisp.
   - [x] Scroll behavior normalized to standard layout.

### Planned Refinement for Iteration 2
To fully satisfy the MVP specification and elevate the layout to a premium level:
1. **Add "Selected Works" Gallery**: Introduce a horizontal swipeable slider showing three distinct, strong artwork details (forearm, shoulder, fine line) on the Home page.
2. **Add dedicated Approach narrative**: Incorporate a concise, fashion-editorial statement about the master's graphic design and body flow philosophy.
3. **Expand Information Block**: Redesign the utilitarian list into a sleek, minimal accordion/tab component detailing:
   - *Консультация* (online steps)
   - *Подготовка* (sleep, food, alcohol restriction)
   - *Противопоказания* (dermatitis, blood, general health)
   - *Уход* (healing film, washing, moisturizing)
4. **Refine layout breathing room**: Ensure each segment occupies clean, visually satisfying sections of the viewport.

---

## Iteration 2: Refined Design (Implemented & Audited)

### Overview
In this iteration, we integrated the missing selected works gallery, the master's design approach philosophy narrative, and expanded the utility list of instructions into a sleek, natively accessible information accordion.

### Checklist vs. MVP Specification (docs/black-carp-mvp.md)

1. **First Screen (Hero Scene)**:
   - [x] Vertical looped video.
   - [x] Title "BLACK CARP" in Cormorant Garamond.
   - [x] Subtitle "Авторская графика · Хабаровск".
   - [x] Booking CTA.
   - [x] Fixed bottom nav bar.
   - *Status*: Complete and aligned.

2. **Home Page Content Flow**:
   - [x] Strong work fragment: Included as the background image for the introductory section.
   - [x] Selected works gallery: Implemented as a horizontal swipeable slider showing three key portfolio works (`Nocturne I`, `Arc Study`, `Quiet Line`) with art labels, satisfying the gallery requirements.
   - [x] Master's approach description: Dedicated "Анатомический поток" section explaining the master's design philosophy and customized sketching.
   - [x] Pricing statement: "Стоимость от 7 000 ₽" clearly displayed.
   - [x] Compact information block: Built as a native `<details>` accordion covering **Консультация**, **Подготовка к сеансу**, **Противопоказания**, and **Уход и заживление** in comprehensive detail.
   - [x] Repeated Telegram transition button: Implemented via the CTA banner.
   - *Status*: Complete. All spec sections are now fully covered and enriched with premium styling.

3. **Visual & Structural System (P1-01 to P3-01 Audits)**:
   - [x] Hash-based routing enables deep links and browser history.
   - [x] Accessibility elements updated (proper headers, `aria-current="page"`).
   - [x] Real Google Fonts (`Cormorant Garamond` and `Inter`) loaded and displayed.
   - [x] Bottom navigation hit areas enlarged to 76px height (touch target > 48px), and icons updated (Gallery frame for works, Message bubble for booking).
   - [x] Grain overlay placed behind text content (`z-index: 1`) to keep text crisp.
   - [x] Scroll behavior normalized to standard layout.
   - *Status*: All previous architectural and visual issues solved. Text readability, tap accessibility, and section layout rhythm are significantly improved.

### Final Verification Results
The redesigned homepage V2 successfully delivers a premium "wow" fashion-editorial feel. Gaps in the specifications have been filled, and all technical audit bugs from V1 have been fully resolved in a separate file workflow (`index_v2.html`, `styles_v2.css`, `script_v2.js`), keeping the main creation branch untouched.

---

## Iteration 3: Desktop Bottom Navigation Fix (Implemented & Audited)

### Overview
We identified and resolved a layout bug where the bottom navigation bar scrolled up and sat in the middle of the viewport on desktop viewports.

### Findings & Resolution
- **Bug**: On desktop viewports (width > 760px), the bottom navigation bar was set to `position: absolute; bottom: 0;` inside the scrollable document. When scrolled, it moved up into the middle of the viewport, overlapping text and images.
- **Fix**: Reverted the desktop `.bottom-nav` positioning to `position: fixed; bottom: 24px;` with a bottom border and rounded corners. This aligns it with the centered `.app-shell` container, keeping it suspended and pinned to the bottom of the mockup frame as a fixed overlay.
- **Status**: Resolved. The navigation bar now remains static at the bottom of the preview frame while content scrolls smoothly behind it.


