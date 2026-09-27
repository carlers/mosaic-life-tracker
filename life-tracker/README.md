# Mosaic

Offline-first life tracker built with React, TypeScript, Vite, RxDB, and Appwrite.
Calendar and Todo views, task/category management, social calendars, messaging,
account/settings, and PWA support are implemented. Diary and Notifications remain backlog.

## Run your own Mosaic

A fork can provision its own empty Appwrite project with one command after creating a
temporary project API key:

```bash
npm run mosaic:bootstrap -- --print-scopes
APPWRITE_API_KEY='<temporary-key>' npm run mosaic:bootstrap -- \
  --project '<project-id>' \
  --endpoint 'https://<region>.cloud.appwrite.io/v1'
```

The bootstrap creates the active database schema, image bucket, trusted messaging Function,
localhost Web platform, and a fork-specific `.env.local`. It refuses non-empty Appwrite
projects. Revoke the temporary API key immediately afterward. See
[Forking and independent recovery](docs/FORKING.md) for deployment and recovery details.

## Development

From `life-tracker/`, use Node 22 and `npm ci`, then `npm run dev`.
`npm test -- <test-file>` runs focused tests; `npm run verify` runs contracts,
discovery, lint, all Vitest projects, and the production build. Browser contracts
are separate locally and included in canonical CI acceptance.

Start with the [documentation index](docs/README.md). AI contributors follow
[AGENTS.md](AGENTS.md); current work is in [the checkpoint](docs/SESSION_STATE.md).
