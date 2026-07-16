# A04 — Needs more research

- Live Telegram screenshots: client `/start`, comments, unsupported messages, master notification, stale callbacks and group/private chat behavior.
- Physical Telegram iOS/Android: WebView safe areas, keyboard, datetime picker, clipboard, blob attachments and Telegram BackButton.
- Screen readers and keyboard-only pass across public view changes, route modal, CRM rerenders and terminal dialog.
- Cold-cache network trace for video, map and hidden route images.
- Production data audit for multiple active requests, `scheduled` without date, past schedules, lost client-message payloads and outbox failures.
- WIP backend browser runtime after the parallel patch is committed/stabilized; current static UI and 12/12 tests were verified, but a second isolated runtime could not be started in this audit.
- Product decisions: reversible statuses, clarification channel, scheduled invariant/timezone, unread/attention ownership, multiple requests per client and multi-master assignment.

