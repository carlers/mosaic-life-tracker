# Mosaic Roadmap

This roadmap records durable workstreams and batch status. `SESSION_STATE.md` contains the current handoff; `AGENTS.md` contains working rules.

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
- [x] Strategy B tombstone retention: 90-day stale-cursor recovery and scheduled garbage-collection function

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

## Feature backlog

- [ ] Todo List view: compact color-only calendar with a selected-day task list
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

Strategy B tombstone retention implementation is complete. To preserve the Appwrite Free-plan function budget, garbage collection shares the existing `message-action` Function through its trusted schedule-trigger path; Appwrite Console deployment/scheduling on that existing Function remains the operational setup step. Feature backlog work resumes after that setup.
