# Mosaic Roadmap

This roadmap records durable workstreams and batch status. `SESSION_STATE.md`
contains the current handoff; `AGENTS.md` contains working rules.

## Delivered foundation

- [x] Vite, React 19, TypeScript, Tailwind, PWA shell, and persistent local storage
- [x] RxDB local data model and custom Appwrite TablesDB synchronization
- [x] Authentication, cached offline identity, multi-tab lifecycle, and guarded SDK surface
- [x] Calendar, task CRUD/actions, categories, account/settings, and shared bottom sheets
- [x] Social graph, friend calendars, direct messaging, replies, reactions, and read receipts
- [x] Error boundaries, accessibility baseline, sync-status UI, and four-project Vitest suite
- [x] Phase 1 reliability audits
- [x] Phase 2 refactor program (batches 2.1–2.10)
- [x] Codex VS Code workflow migration

The original milestone checklist predated several shipped features and is superseded by
this roadmap. Git history and `docs/PROJECT_REFERENCE.md` retain the implementation record.

## Phase 3 — optimize audit and implementation

- [ ] **3.1 Bundle audit:** measure the production build and identify route, vendor,
  and asset opportunities without changing runtime behavior
- [ ] **3.2 Route-level code splitting**
- [ ] **3.3 Lazy image loading**
- [ ] **3.4 Image-cache LRU sweep:** resolve accepted limitation OFF-6 with an
  access-time policy and byte budget
- [ ] **3.5 Service-worker precache review:** keep user-generated content out of precache;
  assess update prompt, `beforeinstallprompt`, and Profile sharing
- [ ] **3.6 Build-size guard:** add a documented budget check to CI or local verification
- [ ] **3.7 PostHog foundation:** error tracking and feature flags, with session replay and
  autocapture disabled

## Phase 4 — specification and accessibility audit

- [ ] Audit instructions, reference discoverability, and enforceable project contracts
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

Phase 3.1 is the next proposed batch. Do not begin it as part of the workflow migration.
