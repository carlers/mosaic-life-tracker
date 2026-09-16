# LifeTracker (Mosaic)

An offline-first, local-first PWA life tracker. A unified dark-mode calendar that aggregates tasks, categories, a social calendar layer, and 1:1 messaging with friends. Built to work 100% offline with cloud sync as a background concern, not a dependency.

## Status

Pre-release. Phase 1 (bug audit hardening) and Phase 3.1–3.4 (messaging, reactions, auth architecture) are complete. Test suite is live (152 tests, Vitest). Phase 3.5–3.7 (Todo List view, Diary view, Notifications) and API integrations are queued.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v3 · React Router v7 · RxDB v17 (Dexie storage) · Appwrite 2.0 (TablesDB) · vite-plugin-pwa

## Development

```
npm install
npm run dev          # start dev server (https://localhost:5173)
npm test             # run the test suite
npm run lint         # eslint
npm run build        # production build
```

Mobile PWA testing requires a Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:5173`) plus whitelisting the tunnel URL in Appwrite Platforms. See §3 of AGENTS.md for details.

## Revision workflow

All AI-authored revisions are delivered as a single `mosaic` fenced code block and applied via the installer:

```
npm run apply         # write files, run lint → test → build
npm run apply:docs    # write files, skip verification (docs-only changes)
npm run apply:start   # write files, verify, then start dev server
npm run apply:rollback  # restore from the most recent backup
```

See §5.1 of AGENTS.md for the mega-file format specification.

## Conventions

**AGENTS.md is the canonical spec.** It documents every architectural rule, naming convention, hook contract, and audit-hardening invariant. Any non-trivial change must conform to it.

## License

Not yet chosen.
