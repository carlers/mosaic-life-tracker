# LifeTracker (Mosaic)

Mosaic is an offline-first, local-first PWA for tasks, calendars, friend activity, and
direct messaging. RxDB provides immediate local data access while Appwrite TablesDB
supplies background synchronization and cross-device persistence.

## Status

Pre-release. The core calendar, task actions, categories, auth/account settings, social
graph, friend calendars, messaging, replies, reactions, and offline/sync hardening are
implemented. Todo List, Diary, and Notifications remain in the feature backlog. The
[Phase 3.1 bundle audit](docs/BUNDLE_AUDIT.md), Phase 3.2 code splitting, and Phase 3.3
visibility-gated image acquisition are complete. The next proposed batch is the Phase
3.4 image-cache LRU policy in
[PLAN.md](PLAN.md).

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v3 · React Router v7 · RxDB v17
(Dexie storage) · Appwrite TablesDB · Vitest · vite-plugin-pwa

## Development

Open this directory (`life-tracker/`) as the VS Code workspace and run commands here:

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

Mobile PWA testing requires a Cloudflare Tunnel (`cloudflared tunnel --url
http://localhost:5173`) and the tunnel URL must be allowed in Appwrite Platforms.

## AI workflows

`AGENTS.md` contains shared project instructions, `PLAN.md` owns the roadmap, and
`SESSION_STATE.md` is the workflow-neutral checkpoint. Detailed product and architecture
contracts live in [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md).

- [Codex workflow](docs/CODEX_WORKFLOW.md) — direct VS Code inspection, editing, and checks.
- [DeepSeek Web workflow](docs/LEGACY_WORKFLOW.md) — compact handoff packets, separate
  planner/implementer roles, and the retained full-file installer.

Generate a resume prompt or DeepSeek packet with `npm run handoff -- <target>`.

## License

Not yet chosen.
