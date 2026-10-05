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
- [x] Workflow wall-time optimization — quiet WIP task pushes, one focused task checkpoint, one stable-Preview full gate, cached build dependencies, and provenance/tree-based acceptance reuse for exact stable Preview → dev promotions
- [x] Sync-engine race hardening — fail-closed freshness barriers, authenticated-owner generations, account-scoped compatibility metadata, serialized pilot lifecycle, cross-tab durable retry queues, owner-scoped retry timers, Realtime-as-wakeup checkpoint safety, fail-closed remote ownership validation, and a maintained sync scenario matrix
- [x] Build-vs-reuse audit — current custom infrastructure and third-party/platform alternatives are inventoried in `BUILD_VS_REUSE_AUDIT.md`; the highest-value follow-ups are an Appwrite TablesDB transaction proof for owner-write sync, a shared internal RxDB/TablesDB pilot harness, and a measured auxiliary-IndexedDB refactor that reuses the already-resolved Dexie runtime before considering `idb`, rather than a broad dependency rewrite.
- [x] Multi-device RxDB restart hardening — normal startup resumes versioned RxDB metadata directly, first-sync conflicts are semantic rather than LWT-based, and >90-day recovery is read-only with DB-local freshness proofs
- [ ] Shared-RxDB account-switch sync isolation and import convergence — foreign-account cache rows are now acknowledged as out-of-scope, Sync Status names pending groups, and TodoMate-scale restores use the bounded five-minute ceiling. Live re-acceptance then isolated a separate Diary schema defect: the client sends `created_at` but production/manifest Diary lacked that column. `chatgpt/diary-created-at-schema-fix` adds the manifest column, idempotent migration, stable legacy fallback, and regressions; focused/full CI plus live schema migration and diary-row convergence remain.
- [x] Permanent account erasure — marker-backed irreversible pivot, fail-closed ambiguous clients, account-scoped local erasure, idempotent/retryable cleanup, stale peer-reference sanitization, DR key-rotation support, schema/erasure-policy checks, and large-account Function-budget hardening are accepted. Disposable-account live acceptance removed Auth, sessions, owned/cross-user rows, embedded references, deletion job, and all 37 owned files; the timeout retry completed in 15.6s after peer-scan prefiltering.
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

- [x] TodoMate → Mosaic one-way migration: direct browser-to-TodoMate/Firebase read path,
  full owned Goal/TodoItem/Diary history preview, and Merge-only Mosaic import are implemented
  with automated privacy/mapping coverage and real-account Preview/import acceptance. The live
  account preview contained 505 tasks, 13 categories, and 1 diary entry; 3 undated tasks were
  intentionally placed on the import day and 37 TodoMate photo attachments were reported but not
  copied. Recurring routine definitions remain intentionally out of scope for the first version.
- [ ] TodoMate photo migration enhancement: direct browser photo download, secure Google Storage
  auth retry, deterministic ZIP bundling, and idempotent fill-in of photos on already-imported
  tasks are implemented with automated coverage. Real-account re-import succeeded for all 37
  attachments without task duplication. Final acceptance is limited to the task-photo viewer
  aspect-ratio regression discovered while opening the migrated photos; the viewer fix is under
  hosted Preview verification.

## Feature backlog

- [x] Todo List view: compact color-only calendar with a selected-day task list
- [x] Optional regional holiday overlay: synced show/region/type preferences, cached read-only holiday data, Calendar/Todo/Day View presentation, and viewer-local friend-calendar overlay
- [ ] Diary view: per-day text entries with `public`, `followers`, or `private` visibility
- [ ] Notifications tab
- [ ] Routines and reminders
- [ ] Optional external API integrations
- [ ] Advanced social features, including selected-follower visibility if it enters scope
- [ ] Analytics and progress views

## Deferred technical work

- [x] Evaluate Appwrite transaction CAS for owner-write replication — rejected after a live disposable-project proof showed a transactional read does not protect a later staged write from an intervening external update. Stage-before-external-write conflicts do return 409, but that does not close Mosaic's current read→compare→write window. Conditional `updateRows` CAS remains deferred because it would require a new collision-safe remote revision-token protocol.
- [ ] Replication deduplication — first accepted step extracts shared local push-checkpoint capture and owner-scoped Realtime→RESYNC mechanics across task/category/diary/settings. Continue only with similarly obvious primitives; do not build a generic sync framework unless maintenance fan-out measurably improves.
- [ ] Evaluate direct Dexie reuse for auxiliary IndexedDB — `pendingImages.ts` is the first prototype using direct Dexie 4.4.2 with the existing DB/store/version. Keep it only if stable-Preview tests and build/static-closure metrics show no material regression; friend/image caches stay native until then. Test `idb` only as a fallback.
- [ ] Revisit cross-device last-write-wins only if collaboration or active multi-device editing makes the accepted limitation material
- [ ] Revisit >90-day stale-recovery client-clock tolerance only if recovery reports show legitimate offline edits being conservatively preserved or remote tombstones being ambiguous; steady-state RxDB pulls use server-authored tuple checkpoints and are unaffected.

## Batch boundary

Strategy B tombstone retention and its Appwrite rollout are complete. Garbage collection currently shares `message-action`; the backend-capacity plan now reserves that slot as the future general `app-api` and reserves the second Function slot for isolated disaster backups. Disaster recovery is the active next workstream on `security/disaster-backups`; current execution details live in SESSION_STATE.md.
