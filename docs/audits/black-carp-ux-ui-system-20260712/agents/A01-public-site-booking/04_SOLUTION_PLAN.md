# A01 — Solution plan after WIP review

## Current scope and counts

This plan is based on baseline `4fe2382`, the current uncommitted WIP diff, 12/12 passing WIP tests and current-run browser screenshots. It does not authorize implementation.

| Set | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|
| Iteration 1 baseline | 15 | 17 | 1 | 33 |
| Fixed by current WIP | 3 | 0 | 0 | 3 |
| Remaining after WIP | 12 | 17 | 1 | 30 |

Among P1/P2 findings, 29 remain: 5 partially addressed, 22 still open and 2 needing runtime verification. `P1-A01-01`, `P1-A01-07` and `P1-A01-09` are excluded from implementation planning because the current WIP already closes their scoped defects. They need regression coverage only.

Current visual evidence adds no new A01 count: the uncontrolled orange heading/success outline (`screenshots/03-booking-start.png` through `08-booking-success.png`) is folded into the remaining focus work, and the profile hierarchy problem (`screenshots/09-mobile-profile.png`) is folded into the remaining profile work.

## Target boundaries

The durable target is one explicit lifecycle, not more local patches:

```text
versioned draft state
  -> validated booking command
  -> committed request + queued notification
  -> public client read model with next action
  -> state-specific profile UI
```

Ownership should be explicit:

- Server owns accepted field limits, normalized body taxonomy, price, authoritative timestamps, request status, appointment truth and public next-action data.
- Frontend owns only the current draft, local presentation history, file-processing state and best-effort recent-request pointers.
- Outbox owns notification delivery; booking success means the request is committed, not that Telegram delivery completed.
- UI focus/visual state is one design-system concern, not browser defaults plus isolated component rules.

## Durable implementation sequence

### 0. Lock product decisions before changing contracts

Resolve these decisions in one short product/engineering record:

1. Profile model: latest request only, recent requests on this device, or public-code lookup. Recommended MVP direction: recent device-local requests plus direct lookup by known public code; do not introduce client accounts yet.
2. `need_details`: canonical response channel and exact state-specific CTA. It must identify the request explicitly.
3. `scheduled`: public fields safe to return (`scheduledAt`, duration, timezone, comment policy) and the invariant that scheduled status requires an appointment.
4. Reference reload policy. Recommended: do not persist image binaries in `localStorage`; persist only metadata, then require explicit reattach or explicit discard before advancing after reload.
5. Draft lifetime/privacy. Recommended: schema version, creation/update timestamps, short expiry and a visible Resume/Discard choice.
6. Response-time promise, privacy-policy destination, route-step copy and canonical Russian status vocabulary.

These decisions unblock `P1-A01-10..11`, `P2-A01-16`, `P2-A01-19`, `P2-A01-26..28` and cross-area clarification/scheduling work.

### 1. Establish canonical booking and public-status contracts

**Findings:** `P1-A01-06`, `P1-A01-08`, `P1-A01-10..11`, `P2-A01-20..21`, `P2-A01-28..29`.

1. Define one versioned public booking schema/manifest containing:
   - field lengths and requiredness;
   - body zones/subzones/sides;
   - file count/type/decoded-size limits;
   - stable error codes with category: `correctable`, `retryable`, `rate_limited`, `unknown_outcome`;
   - status labels, safe public fields and next-action types.
2. Make the server authoritative and make the browser consume or contract-test the same schema. Remove duplicated runtime/static body definitions and unreachable price branches.
3. Return booking success immediately after the database/outbox commit. Notification delivery continues independently. Keep the current response shape additively for one rollout, but stop making UI success depend on `masterNotified`.
4. Expand `GET /api/booking/status/:publicCode` additively with authoritative `submittedAt`, safe scheduling fields and a structured `nextAction`. Set explicit `private, no-store`/freshness policy.
5. Map every public error to one recovery mode. A 400 points to the exact field, 413 to files, 429 to a wait-until value, 5xx/offline to retry, and timeout after a possible commit to an idempotent “checking outcome” state.
6. Add request identity to every clarification action/deep link. Coordinate this contract with A02/A03 rather than adding a site-only shortcut.

**Acceptance gate:** the browser never labels a server 400/429 as “Нет связи”; `scheduled` cannot be returned without appointment truth; profile receives enough data to show the next action without exposing client PII.

### 2. Replace mutable wizard behavior with a deterministic state machine

**Findings:** `P1-A01-02..06`, residual `P1-A01-08`, `P2-A01-18..20`, `P2-A01-22..23`.

1. Model steps and answers through explicit transition functions/reducer rules. When an upstream answer changes, normalize all invalid descendants in one place:
   - first tattoo `yes` clears `beenToMaster`;
   - has-sketch `no` clears sketch binary/comment and upload-history branch;
   - changing zone/subzone reconciles side only according to an explicit rule;
   - summary is derived only from reachable normalized state.
2. Introduce file states per slot: `idle`, `processing`, `ready`, `lost_after_reload`, `error`. Continue/Submit must wait for processing and must never truncate a visible selection silently.
3. Validate file type, original size/dimensions and decode errors before compression. Preserve the three-reference limit across concurrent callbacks.
4. Autosave text on input through a throttled draft writer. Add schema version, timestamps, expiry and migration. Invalid/old drafts open a Resume/Discard state rather than jumping directly into a later step.
5. Wrap all storage access in a best-effort adapter. Remote success always renders success even if recent-request/draft storage fails; profile then explains that device tracking is unavailable.
6. Use a real `<form>` for final contact/consent. Share limits with the public schema, preserve Enter submission and return persistent field-level errors linked with `aria-describedby`.
7. Keep the WIP transition lock and side control; add state-machine unit tests instead of expanding ad hoc timers.

**Acceptance gate:** all Back/branch/reload paths produce one normalized payload; selected visible files equal submitted files; storage denial cannot turn a committed request into visual failure.

### 3. Rebuild completion, success and profile as one client workflow

**Findings:** `P1-A01-10..11`, `P2-A01-16..18`, `P2-A01-20..21`, `P2-A01-25..27`, plus visual `P2-A04-06`.

1. Rename the final state from “Анкета заполнена” to a truthful review/contact instruction, or collect the required contact before declaring completion.
2. Add per-section Edit actions that return to the relevant step while preserving a normalized path. Protect full restart with a clear confirmation and state what will be deleted.
3. Make success explain:
   - request saved;
   - what the code is for;
   - expected response window;
   - Profile/status action;
   - optional Telegram continuation;
   - what to do if the master does not respond.
4. Move operational status above the decorative profile image. The first mobile viewport must show request code, human status, submitted/appointment time and the state-specific CTA. The current screenshot proves the opposite: only branding/image and eventually the number are visible.
5. Support the selected multi-request policy without silently overwriting earlier active requests. Migrate the existing one-pointer object into the new local list/lookup model.
6. Add explicit retry for status failures and an `online` refresh. Abort obsolete requests and apply a response only if its public code still matches the active profile item.
7. Use server `submittedAt`, not client time. Treat malformed local metadata as recoverable and continue with a server lookup when a code exists.
8. Make required contact controls visibly bounded in the dark theme. Keep invalid state distinct from ordinary focus and from readonly/disabled state.
9. Link consent text to the agreed privacy context without expanding this audit into a legal-compliance claim.

**Acceptance gate:** `need_details` and `scheduled` are actionable; offline profile visibly retries; two active requests remain reachable; status content is visible without scrolling past a decorative image at `390×844`.

### 4. Finish navigation, focus, motion and touch accessibility

**Findings:** `P1-A01-12..15`, `P2-A01-24..25`, `P2-A01-31`, current `P1-A04-01`.

1. Create a single focus policy:
   - programmatically focused non-interactive headings/success containers receive no browser-default visual box;
   - interactive `:focus-visible` uses the strong shared token;
   - never blanket-remove focus from interactive controls.
2. On top-level view change, focus a stable view heading/container and announce the new context. Do not leave focus inside a hidden previous view.
3. Complete the WIP route-dialog lifecycle with background `inert`/equivalent assistive isolation, initial focus, trap, Escape, backdrop close and restoration. Replace placeholder route captions with real sequential directions.
4. Add pause/stop for continuous hero motion and honor reduced-motion before autoplay. Define a static poster-only state.
5. Increase destructive/navigation icon targets to the shared minimum without making the visual glyph larger. Verify at zoom and forced colors.
6. Fix the uncontrolled orange outline shown in screenshots `03`–`06` and `08`; preserve visible focus for actual buttons/fields.

**Acceptance gate:** keyboard-only Home → Booking → Profile and route dialog has a deterministic focus order; current orange heading/success outlines are gone; interactive focus remains clearly visible; reduced-motion produces no looping hero motion.

### 5. Complete content and responsive polish after behavior is stable

**Findings:** `P1-A01-12`, `P2-A01-25..26`, `P2-A01-30..31`, `P3-A01-33`.

1. Replace route placeholders and unify Russian grammar/status/summary terminology. Remove internal “Пресет” wording from client copy.
2. Re-evaluate desktop booking composition after functional states are final. `screenshots/11-desktop-booking.png` shows a narrow form stranded in a large empty canvas; any layout change must preserve the mobile one-question rhythm.
3. Defer route images until the modal opens or use verified native lazy loading; provide responsive compressed formats. Reconsider hero `preload="auto"` against first-interaction needs.
4. Measure cold-cache transfer, LCP, CLS and interaction readiness on a slow mobile profile before choosing final media policy.

**Acceptance gate:** optional route media is absent from cold initial transfer; mobile/desktop retain the brand language while operational content remains primary.

### 6. Build verification before rollout

**Finding:** `P2-A01-32` and every remaining P1/P2.

1. Pure unit tests:
   - every branch transition/back correction;
   - draft v1→v2 migration/expiry/corruption;
   - storage-denied success;
   - concurrent file processing and reattach/discard;
   - public error-to-UX mapping.
2. API integration tests:
   - public status for every state, 404 and cache headers;
   - scheduled invariant and safe fields;
   - server-commit response independent of slow Telegram;
   - idempotent outcome recovery, 400/413/429/500.
3. Browser acceptance matrix:
   - `320×568`, `390×844`, `768×900`, `1440×900`;
   - both booking branches, Back correction, reload at steps 4a/7/8, localStorage denial, pending/corrupt/oversized files;
   - success notified/queued/unknown outcome;
   - profile empty/offline/all statuses/two requests;
   - keyboard focus, route trap, reduced motion, 200%/400% zoom and touch targets.
4. Add screenshot assertions for the exact current regressions: no orange outline around headings/success and profile operational card in the first viewport.

## Migration and rollout

1. **Server first, additive:** publish new status/error fields while preserving old keys. Add no-store and scheduling invariant. Do not require the new frontend immediately.
2. **Draft migration:** wrap the current local object as draft schema v1; migrate only compatible text/answers into v2. File metadata becomes `lost_after_reload`. Expired/corrupt data is offered for discard, never silently trusted.
3. **Recent-request migration:** seed the new local list from `black_carp_last_booking`; preserve the existing code even if its local timestamp is invalid.
4. **Historical body data:** do not bulk-change old `front` values. There is no reliable way to infer intent. Audit contradictory historical rows and mark them for manual clarification; add payload/schema version for future records.
5. **Frontend rollout:** deploy state/contract changes behind a short compatibility window, then profile/visual changes. Keep idempotency keys across unknown outcomes.
6. **Stop gate:** do not remove old response fields or draft parsing until browser/API matrices pass and existing recent request codes remain reachable.

## Alternatives and tradeoffs

| Decision | Recommended direction | Rejected/secondary direction | Tradeoff |
|---|---|---|---|
| Reference persistence | Metadata + explicit reattach/discard | Store base64 in `localStorage` | Avoids quota/privacy failures; asks user to reselect after reload. |
| Draft files | Optional IndexedDB only if resume-with-files is a real requirement | Upload temporary server drafts immediately | IndexedDB adds complexity; server drafts add consent/cleanup/security scope. |
| Profile identity | Recent device-local codes + code lookup | Full client account in MVP | Keeps scope small; cannot synchronize silently across devices. |
| Submit/notification | Commit response, async outbox | Wait for Telegram delivery | Gives truthful fast success; UI must distinguish saved from notified. |
| Shared rules | Versioned contract/manifest with contract tests | More duplicated constants | Requires one integration boundary but prevents UI/server drift. |
| Heading focus | Programmatic focus without decorative outline | Remove all outlines | Keeps screen-reader context while protecting interactive keyboard focus. |

## Residual risks after this plan

- Real Telegram iOS/Android behavior still needs physical-device verification.
- Public-code lookup must not expand exposed personal data.
- Existing requests recorded with incorrect side cannot be repaired automatically.
- A response-time promise needs an operational commitment from the master.
- Media/LCP severity remains unconfirmed until a cold-cache trace.
