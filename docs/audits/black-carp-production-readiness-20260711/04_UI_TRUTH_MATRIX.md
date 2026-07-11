# UI Truth Matrix

| UI element | UI says | Based on | Real source of truth | Match? | Evidence |
|---|---|---|---|---|---|
| Final booking button | `Перейти в Telegram` | legacy flow | CRM spec requires on-site submit | no | `index.html:411-415` |
| Success toast | master received / booking saved | `masterNotified` then forced redirect | master usually not notified | no | `script.js:923-931`, `server.js:114-120` |
| Error toast | questionnaire copied, Telegram fallback | any backend error | booking may be unsaved | partly; forced external handoff | `script.js:932-938` |
| Works slide | portfolio image | referenced filename | file absent | no | screenshot `02-mobile-works.jpg` |
| Profile | status/date will appear | static placeholder | no integration | no | `index.html:430-460` |
| Bot client reply | comment delivered | ignored notify result | Telegram may have failed | no | `server.js:314-323` |
| Health | service ok | process can answer | DB/config/bot readiness unchecked | no | `server.js:29-31` |
| CRM route | expected master workspace | technical spec | Express 404 | no | screenshot `05-crm-missing.jpg` |
| Desktop site | premium editorial site | 520px framed shell | mobile preview | no | screenshot `04-desktop-home.jpg` |
| Booking progress | step 1 of 7 then 2 of 6 | branch-dependent computation | total changes after answer | confusing | current browser snapshots |
