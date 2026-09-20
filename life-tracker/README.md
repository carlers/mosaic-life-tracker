# LifeTracker (Mosaic)

Mosaic is an offline-first, local-first PWA for tasks, calendars, friend activity, and
direct messaging. RxDB provides immediate local data access while Appwrite TablesDB
supplies background synchronization and cross-device persistence.

## Status

Pre-release. The core calendar, task actions, categories, auth/account settings, social
graph, friend calendars, messaging, replies, reactions, and offline/sync hardening are
implemented. Todo List, Diary, and Notifications remain in the feature backlog. The
[Phase 3.1 bundle audit](docs/BUNDLE_AUDIT.md), Phase 3.2 code splitting, Phase 3.3
visibility-gated image acquisition, Phase 3.4 bounded image-cache LRU, Phase 3.5 PWA
precache/update/install/share review, and Phase 3.6 production build-size guard are complete.
See [the bundle audit](docs/BUNDLE_AUDIT.md) for the measured budgets and update policy.

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

`npm run build` fails if the generated entry, aggregate JS/CSS, or service-worker
precache payload exceeds its reviewed byte budget. To recheck an existing `dist/`
without rebuilding, run `npm run build:size`.

For faster edit/test loops, use the scoped commands in
[the test workflow](docs/TEST_WORKFLOW.md); full verification remains the completion gate.
Local, privacy-preserving task and repair-loop metrics are documented in
[the workflow telemetry guide](docs/WORKFLOW_TELEMETRY.md). Before an acceptance gate,
the [test workflow](docs/TEST_WORKFLOW.md) maps every behavioral change to explicit
automated, red-green, manual, skipped, or not-applicable evidence without judging adequacy.

Mobile PWA testing requires a Cloudflare Tunnel (`cloudflared tunnel --url
http://localhost:5173`) and the tunnel URL must be allowed in Appwrite Platforms.

## AI workflows

Mosaic supports two provider-neutral execution adapters:

- [Workspace-agent workflow](docs/CODEX_WORKFLOW.md) — Codex local/IDE, Codex Cloud,
  or another agent with direct repository, shell, and Git access.
- [Web-chat workflow](docs/WEB_CHAT_WORKFLOW.md) — ChatGPT, DeepSeek, or another web/mobile
  chat using compact packets and the retained full-file installer.

`AGENTS.md` contains shared rules, `PLAN.md` owns the roadmap, and `SESSION_STATE.md`
records the workflow-neutral checkpoint. Every completed AI response includes a compact
handoff footer so a rate or context limit can be recovered without another reply from the
current agent. Git transfers exact files between separate workspaces; packets transfer
context into web chat; complete `mosaic` bundles transfer changes back.

Generate a resume prompt or packet with:

```bash
npm run handoff -- agent
npm run handoff -- chat-plan
npm run handoff -- chat-implement
```

A task may switch workflows at any safe checkpoint, including mid-task or mid-batch.

## License

Not yet chosen.
