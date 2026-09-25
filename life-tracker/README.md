# Mosaic

Offline-first life tracker built with React, TypeScript, Vite, RxDB, and Appwrite.
Calendar and Todo views, task/category management, social calendars, messaging,
account/settings, and PWA support are implemented. Diary and Notifications remain backlog.

## Development

From `life-tracker/`, use Node 22 and `npm ci`, then `npm run dev`.
`npm test -- <test-file>` runs focused tests; `npm run verify` runs contracts,
discovery, lint, all Vitest projects, and the production build. Browser contracts
are separate locally and included in canonical CI acceptance.

Start with the [documentation index](docs/README.md). AI contributors follow
[AGENTS.md](AGENTS.md); current work is in [the checkpoint](docs/SESSION_STATE.md).
