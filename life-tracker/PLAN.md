# Mosaic Roadmap

This roadmap records durable workstreams and batch status. `SESSION_STATE.md`
contains the current handoff; `AGENTS.md` contains working rules.

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

The original milestone checklist predated several shipped features and is superseded by
this roadmap. Git history and `docs/PROJECT_REFERENCE.md` retain the implementation record.

## Phase 3 — optimize audit and implementation

- [x] **3.1 Bundle audit:** measured production artifacts and traced route, vendor,
  and asset opportunities; see [findings and baseline](docs/BUNDLE_AUDIT.md)
- [x] **Service-worker activation prerequisite (from 3.5):** wait for old controlled
  clients to close; enforce generated policy during builds; verified in Chromium
- [x] **3.2 Route-level code splitting:** lazy routes and major optional interactions,
  offline chunk precache, explicit failed-import recovery, and two-release browser test
- [x] **3.3 Lazy image loading:** gate upstream image acquisition by proximity, keep
  selected content eager, and preserve shared object URLs without scroll reacquisition
- [x] **3.4 Image-cache LRU sweep:** 50 MiB byte budget, persistent access metadata,
  startup/write sweeps, deterministic legacy migration, and fail-soft cache hits
- [x] **3.5 Service-worker precache review:** emitted-static-only precache validation,
  explicit user-approved update UI, captured `beforeinstallprompt` install UI, stable
  manifest identity, and native Profile sharing with clipboard fallback
- [x] **3.6 Build-size guard:** production builds enforce reviewed raw/gzip entry,
  aggregate app-asset, and unique precache byte budgets
- [ ] **3.7 PostHog foundation:** error tracking and feature flags, with session replay and
  autocapture disabled

## Phase 4 — specification and accessibility audit

- [x] Audit instructions, reference discoverability, and enforceable project contracts
- [ ] Complete a WCAG AA review
- [ ] Add calendar-grid semantics
- [ ] Add keyboard day navigation to `DayViewSheet` (A11Y-33)

## Feature backlog

- [ ] Todo List view: compact color-only calendar with a selected-day task list
- [ ] Diary view: per-day text entries with `public`, `followers`, or `private` visibility
- [ ] Notifications tab
- [ ] Routines and reminders
- [ ] Optional external API integrations
- [ ] Advanced social features, including selected-follower visibility if it enters scope
- [ ] Analytics and progress views

## Deferred technical work

- [ ] Revisit cross-device last-write-wins only if collaboration or active multi-device
  editing makes the accepted limitation material
- [ ] Revisit sync clock-skew tolerance if users report missing rows after clock changes
- [ ] Revisit cross-tab backoff sharing if rate-limit pressure appears in multi-tab use

## Batch boundary

Phase 4.1 is verified complete. The source-level Phase 4 WCAG review and remediation are
also automated-gate green, with the roadmap checkbox intentionally left open until the
manual browser protocol in `docs/ACCESSIBILITY_AUDIT.md` is recorded. Calendar-grid
semantics and A11Y-33 remain separate next batches. Phase 3.7's automated gate is green,
but its live PostHog staging/manual checks remain pending.
