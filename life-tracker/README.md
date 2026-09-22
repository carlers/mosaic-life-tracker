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
npm run verify
```

`npm run build` fails if the generated entry, aggregate JS/CSS, or service-worker
precache payload exceeds its reviewed byte budget. To recheck an existing `dist/`
without rebuilding, run `npm run build:size`.

`npm run verify` runs the project-contract check, Vitest discovery guard, lint, full Vitest suite, and production build in fail-fast order. Locally, its terminal output is streamed normally and the complete captured run is copied to the system clipboard on exit, including failed runs. In CI, clipboard handling is skipped and the streamed output stays in the GitHub Actions log. Clipboard availability never changes the verification exit status.

GitHub Actions has one verification workflow, `Verify`. Its repository-gate job runs
`npm run verify`; after that passes, its dependent browser-contract job runs every
repository-owned Playwright spec under `tests/e2e/` through
`npm run test:browser-contract`. Browser-backed contracts stay in the repository test
tree without being misclassified as Vitest tests.

For faster edit/test loops, use the scoped commands in
[the test workflow](docs/TEST_WORKFLOW.md); full verification remains the completion gate.
Local, privacy-preserving task and repair-loop metrics are documented in
[the workflow telemetry guide](docs/WORKFLOW_TELEMETRY.md). Before an acceptance gate,
the [test workflow](docs/TEST_WORKFLOW.md) maps every behavioral change to explicit
automated, red-green, manual, skipped, or not-applicable evidence without judging adequacy.

For phone/browser review, prefer the stable hosted preview documented in
[the preview deployment guide](docs/PREVIEW_DEPLOYMENT.md). Appwrite requires that preview
hostname to be registered as a Web platform. A Cloudflare Tunnel remains the fallback for
uncommitted local work.

## Project contracts

Use this map before changing behavior or project process. Each file owns a distinct kind of truth rather than forming one global precedence stack:

| Concern | Authoritative source |
|---|---|
| Active implementation rules and non-negotiable constraints | [AGENTS.md](AGENTS.md) |
| Durable product and architecture contracts | [Project reference](docs/PROJECT_REFERENCE.md) |
| Roadmap sequencing and verified completion state | [PLAN.md](PLAN.md) |
| Current checkpoint, pending verification, and next action | [SESSION_STATE.md](SESSION_STATE.md) |
| Workspace-agent execution | [Workspace-agent workflow](docs/CODEX_WORKFLOW.md) |
| GitHub-connected chat and remote verification | [Remote verification workflow](docs/REMOTE_VERIFY.md) |
| Hosted phone/browser preview | [Preview deployment](docs/PREVIEW_DEPLOYMENT.md) |
| Web/mobile chat without repository access | [Web-chat workflow](docs/WEB_CHAT_WORKFLOW.md) |
| Test evidence and discovery | [Test workflow](docs/TEST_WORKFLOW.md) |
| Local workflow telemetry | [Workflow telemetry](docs/WORKFLOW_TELEMETRY.md) |
| Production bundle budgets and audit history | [Bundle audit](docs/BUNDLE_AUDIT.md) |
| Tombstone retention and stale-client recovery | [Tombstone retention](docs/TOMBSTONE_RETENTION.md) |

Run `npm run contracts:check` after documentation/reference changes. It verifies that the authoritative files exist, required entry-point pointers remain discoverable, and local Markdown links in those files resolve. `npm run verify` runs this check and `npm run test:discovery` before lint, tests, and build.

## AI workflows

Mosaic supports three capability-based execution adapters:

- [Workspace-agent workflow](docs/CODEX_WORKFLOW.md) — direct repository, shell, and Git.
- [GitHub-connected chat](docs/REMOTE_VERIFY.md) — direct GitHub repository access plus
  GitHub Actions as the remote verification environment; designed for phone-only work.
- [Web-chat workflow](docs/WEB_CHAT_WORKFLOW.md) — no repository access; compact packets
  and the retained full-file installer.

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
