# Architecture Risks

## AR-01: Synchronous monolith couples durability to external delivery

One request handler owns validation, files, SQL, status and Telegram. Any late failure can contradict earlier durable work. Introduce transaction boundaries and a persisted outbox.

## AR-02: No canonical domain model

UI copy, callbacks and history each define status differently. Establish shared enums/transitions and separate state from activity.

## AR-03: Authorization does not own every protected resource

Even a correct CRM auth middleware would be bypassed by public `/uploads`. Protected data must only be reachable through the same auth boundary.

## AR-04: Schema and deploy are not coordinated

Automatic main deploy plus startup-only creates cannot safely evolve live SQLite. Version migrations, backup, readiness and rollback must be one release process.

## AR-05: Prototype admin surface is a latent destructive boundary

The visual editor can overwrite the site with no auth. It should be removed from production scope or isolated as a loopback-only development utility.

## AR-06: Content and navigation have duplicate sources of truth

Gallery exists in HTML and JS; routes exist in bot URLs and DOM classes. Generated drift already produced missing assets and broken deep links.

## AR-07: Tests are structurally impossible without app construction boundaries

`server.js` opens DB and listens at import time. Refactor construction/startup so API, auth, migrations and bot logic can be tested deterministically.
