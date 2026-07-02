# Findings

## P1-01: Gallery Looks Fake

- Promise: 8 стартовых работ, каждая как отдельный арт-объект.
- Reality: 8 entries reuse 4 assets twice.
- Evidence: `script.js:7-55`.
- Effect: site feels poor because the main proof of мастерство is repetitive.
- Direction: use 8 distinct works or reduce visible count until real content exists.
- Status: confirmed.

## P1-02: Desktop Breaks Premium Positioning

- Promise: desktop should be more editorial, not stretched mobile.
- Reality: desktop is a centered phone-width app shell.
- Evidence: `styles.css:74-81`, `styles.css:520+`; MVP `docs/black-carp-mvp.md:249`.
- Effect: on laptop it looks like a prototype preview, not a finished expensive site.
- Direction: create a true desktop composition with larger media, side typography, and wider gallery rhythm.
- Status: confirmed.

## P2-01: Booking Screen Feels Empty, Not Premium

- Promise: calm, clear consultation screen.
- Reality: large empty black field with generic Telegram icon.
- Evidence: `index.html:112-133`.
- Effect: CTA loses value after the strong hero.
- Direction: add controlled context: consultation format, response expectation, one refined visual fragment.
- Status: confirmed.

## P2-02: Profile Is A Stub

- Promise: minimal personal cabinet.
- Reality: placeholder text and static rows.
- Evidence: `index.html:136-165`.
- Effect: user sees unfinished product surface.
- Direction: hide profile before auth, or make it a deliberately designed locked state.
- Status: confirmed.

## P2-03: Visual System Is Too Safe

- Promise: fashion-editorial, author gallery, strong wow.
- Reality: palette and type are correct, but composition is generic: image + title + CTA + nav.
- Evidence: `index.html:19-45`, `styles.css:165-198`.
- Effect: it looks tasteful, but not distinctive enough for "дорого".
- Direction: stronger art direction: asymmetric crops, controlled image sequencing, fewer repeated UI formulas.
- Status: confirmed.

## P2-04: Russian/English Mix Feels Uncontrolled

- Promise: уважительный тон на русском.
- Reality: decorative English labels mix with Russian UI and work metadata.
- Evidence: `index.html:48`, `index.html:75`, `script.js:10-52`.
- Effect: can read as template/fashion imitation rather than intentional brand language.
- Direction: decide language system: either editorial English as art labels only, or mostly Russian.
- Status: confirmed.

