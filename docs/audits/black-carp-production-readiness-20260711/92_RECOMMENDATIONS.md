# Recommendations

1. Introduce versioned SQLite migrations and one canonical booking/status/activity model.
2. Refactor backend construction for testability, atomic booking persistence and protected attachments.
3. Implement verified Telegram initData authorization and the full CRM API.
4. Notify masters immediately through a durable outbox and WebApp button; keep client Telegram optional.
5. Build the separate mobile-first CRM list/detail workflow with honest loading/error/save states.
6. Update the client form with contact fields, on-site success, route state and draft recovery.
7. Repair media references using verified real assets; implement a real desktop layout and accessible upload controls.
8. Separate notification chat ids from master user ids; harden webhook, timeouts, health and shutdown.
9. Replace placeholder tests/CI with migration, API, bot-stub, auth, client and browser coverage; gate deploy on it.
10. Back up production data and run staging/live smoke only after local gates pass and deployment is explicitly authorized.
