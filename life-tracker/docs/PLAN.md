# Mosaic Roadmap

This roadmap records durable workstreams and batch status. `SESSION_STATE.md` contains the current handoff; `../AGENTS.md` contains working rules.

## Delivered foundation

- [x] Vite, React 19, TypeScript, Tailwind, PWA shell, and persistent local storage
- [x] RxDB local data model and custom Appwrite TablesDB synchronization
- [x] Authentication, cached offline identity, multi-tab lifecycle, and guarded SDK surface
- [x] Calendar, task CRUD/actions, categories, account/settings, and shared bottom sheets
- [x] Social graph, friend calendars, direct messaging, replies, reactions, and read receipts
- [x] Error boundaries, accessibility baseline, sync-status UI, and three-project Vitest suite
- [x] Complete test discovery, scoped development commands, and repeatable timing benchmark
- [x] Quiet expected test output and collection-scoped RxDB test databases
- [x] Phase 1 reliability audits
- [x] Phase 2 refactor program (batches 2.1–2.10)
- [x] Codex VS Code workflow migration
- [x] Provider-neutral workspace-agent and web-chat workflow with rolling mid-batch handoffs
- [x] Strategy B tombstone retention: 90-day stale-cursor recovery and scheduled garbage collection through the existing `message-action` Function

## Phase 3 — optimize audit and implementation

- [x] Phase 3.7 PostHog foundation complete with error tracking and feature flags, session replay and autocapture disabled.

## Phase 4 — specification and accessibility audit

- [x] Audit instructions, reference discoverability, and enforceable project contracts
- [x] Complete WCAG AA review acceptance for current scope
- [x] Add calendar-grid semantics
- [x] Add keyboard day navigation to `DayViewSheet` (A11Y-33)

## Interaction fixes after audit work

- [x] Native bottom-sheet Back stack: nested sheets consume Back one layer at a time before route navigation.
- [x] Calendar gesture ownership: calendar horizontal swipes no longer move the friend carousel; friend swipes remain outside the calendar region.
- [x] Calendar gesture regression coverage added.
- [x] Samsung/PWA manual Back and gesture acceptance completed.

## Launch hardening workstreams

- [x] Phase 1 — Appwrite security/configuration and blocking production dependency audit
- [x] Phase 2 — hosted response headers and local-only HTTPS build isolation
- [x] Phase 3 — code hygiene and performance review
- [x] Test-suite architecture consolidation — behavior-first UI assertions, reduced DOM/browser duplication, and diagnostic performance isolated from canonical correctness
- [ ] Phase 4 — final production acceptance and main release

## Disaster recovery and backend capacity

- [ ] Complete provider-independent disaster-backup rollout on `security/disaster-backups`: exporter/restore/health-check code, R2 secrets/key escrow, the first verified production `COMPLETED` snapshot, isolated restore/full verification, recovered Function deployment, manual application acceptance, and the accepted production backup schedule are complete; only default-branch delivery plus external watcher activation remain.
- [x] Reserve the two Appwrite Function slots by responsibility, not provider: the existing `message-action` Function evolves into the general trusted `app-api` surface for messaging/social operations, tombstone GC, future external API routes/webhooks, and one coordinated maintenance/integration schedule; the second Function is dedicated to privileged `dr-backup` work only.
- [ ] Treat Strava, Spotify, Garmin, Hevy, Letterboxd, YouTube, and later integrations as isolated modules/routes inside `app-api`, with provider secrets and OAuth tokens kept server-side. Do not consume one Appwrite Function per integration.
- [x] Export the whole recoverable Appwrite backend dynamically rather than hardcoding today's synced tables: Auth users and password-hash metadata, TablesDB table schema/columns/indexes/permissions/rows, Storage bucket configuration/files/permissions/raw bytes, plus non-secret infrastructure/function definitions from Git/IaC.
- [x] Use a versioned DR format with independent authenticated encryption, content-addressed/deduplicated file blobs, encrypted manifests, object hashes/counts, and a final `COMPLETED` marker so incomplete runs are never retention candidates.
- [x] Start with 7 daily + 4 weekly + 6 monthly restore points and a recent-object lock window; never prune valid older snapshots after a failed/incomplete run. Escrow the backup encryption key and R2 recovery credentials outside Appwrite, with key-version metadata for rotation.
- [x] Build restore as a separate admin CLI requiring target-project write credentials. Restore into a fresh isolated DR project, preserve IDs/password hashes/permissions where Appwrite supports it, verify schemas/row IDs/counts/checksums/file hashes/permissions, then run a temporary Mosaic build against the restored project for manual login/tasks/diary/settings/social/messages/photos acceptance.
- [x] Make Appwrite project/function/resource identifiers environment-configurable and keep non-secret infrastructure definitions in the repository so recovery does not depend on Console memory.
- [x] Make Mosaic independently forkable: version the active Appwrite backend manifest, provide a fresh-project bootstrap command that deploys schema/Storage/messaging infrastructure and browser config, refuse non-empty targets, and prevent unconfigured forks from falling back to the original production backend.
- [x] Add stale-backup detection and an external GitHub Actions watcher that uses a separate read-only R2 credential and stays disabled until rollout.
- [x] Enable the production backup schedule only after the isolated restore drill passes. User-facing Backup & Restore remains a separate feature and is not the DR mechanism.

## Data portability and migration

- [ ] TodoMate → Mosaic one-way migration: direct browser-to-TodoMate/Firebase read path,
  full owned Goal/TodoItem/Diary history preview, and Merge-only Mosaic import are implemented
  with automated privacy/mapping coverage. Live acceptance with a real TodoMate account remains
  required. Task photo attachments and recurring routine definitions are intentionally reported
  but not reconstructed in the first version.

## Feature backlog

- [x] Todo List view: compact color-only calendar with a selected-day task list
- [ ] Diary view: per-day text entries with `public`, `followers`, or `private` visibility
- [ ] Notifications tab
- [ ] Routines and reminders
- [ ] Optional external API integrations
- [ ] Advanced social features, including selected-follower visibility if it enters scope
- [ ] Analytics and progress views

## Deferred technical work

- [ ] Revisit cross-device last-write-wins only if collaboration or active multi-device editing makes the accepted limitation material
- [ ] Revisit sync clock-skew tolerance if users report missing rows after clock changes
- [ ] Revisit cross-tab backoff sharing if rate-limit pressure appears in multi-tab use

## Batch boundary

Strategy B tombstone retention and its Appwrite rollout are complete. Garbage collection currently shares `message-action`; the backend-capacity plan now reserves that slot as the future general `app-api` and reserves the second Function slot for isolated disaster backups. Disaster recovery is the active next workstream on `security/disaster-backups`; current execution details live in SESSION_STATE.md.
