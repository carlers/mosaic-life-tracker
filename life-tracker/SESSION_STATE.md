# SESSION STATE

Updated: 2026-09-17T00:00:00Z
ActivePlan: Phase 1 audits — final sweep
CurrentBatch: 8 of 9
CurrentTask: 1.7.b Item 13 — accessibility (sub-batch 3: task/calendar surfaces)
Status: in_progress
NextAction: Run `npm run apply`, then continue to 1.7.c (layout/nav/settings surfaces accessibility — final sub-batch of Phase 1).
NextChatRole: chat2
BatchPlan:
- Phase 1 audits — final sweep (current)
  - [x] 1.1 Item 10 — offline behavior audit (findings inline below)
  - [x] 1.1.chore — dump XML format
  - [x] 1.1.chore-b — §25.4/§25.6 offboarding-trigger split + review payload
  - [x] 1.1.chore-c — Chat 1 docs carve-out + review-artifact boundary
  - [x] 1.1.chore-d — SESSION_STATE.md as phase document + audit findings baked in
  - [x] 1.1.fix — Offline write resilience (OFF-8, OFF-9, OFF-10, OFF-3 error-message only)
  - [x] 1.1.chore-e — §25.8 post-batch instructions + §25.9 reasoning discipline + apply clipboard
  - [x] 1.1.chore-f — AGENTS.md compression
  - [x] 1.1.chore-g — AGENTS.md compression follow-up
  - [x] 1.1.fix.b — Cached-data rendering + small offline fixes (OFF-11, OFF-13, OFF-12, OFF-2, OFF-4)
  - [x] 1.2 Item 9 — realtime subscriptions layer (Option A: all six tables)
  - [x] 1.3 Item 12 — error boundaries / crash resilience (Option 3: top-level + per-route)
  - [x] 1.4 Item 7 residual — storage/imageCache consolidation (absorbs OFF-6, OFF-7)
  - [x] 1.5 Item 11 — PWA / service worker audit + fixes
  - [x] 1.6 Item 13 — accessibility (sub-batch 1: primitives layer)
  - [x] 1.7.a Item 13 — accessibility (sub-batch 2: message surfaces)
  - [x] 1.7.b Item 13 — accessibility (sub-batch 3: task/calendar surfaces)
  - [ ] 1.7.c Item 13 — accessibility (sub-batch 4: layout/nav/settings surfaces — FINAL batch of Phase 1)
- [ ] Phase 2 — refactor audit → refactor
- [ ] Phase 3 — optimize audit → optimize (bundle 1.7 MB, route splitting, lazy images; receives OFF-6 LRU cap)
- [ ] Phase 4 — spec audit group (meta-audit of AGENTS.md, discovery, enforcement; receives full WCAG AA audit + calendar grid semantics)
- [ ] Feature work — Phase 3.5 Todo List, 3.6 Diary, 3.7 Notifications, API integrations (paused)
OpenQuestions:
- H1 — offline auth gate (OFF-1). Blocked pending product/architecture decision.
Findings:
- CHORE-G-1 through CHORE-G-5 — resolved.
- OFF-1 Critical — Blocked on H1.
- OFF-2 through OFF-13 — resolved.
- RT-1 through RT-4 — resolved 1.2.
- ERR-1 through ERR-4 — resolved 1.3.
- STO-1 — resolved 1.4.
- PWA-1 through PWA-6 — resolved 1.5.
- A11Y-1 through A11Y-11, A11Y-12 through A11Y-17, A11Y-24 through A11Y-27 — resolved 1.6 / 1.7.a.
- A11Y-18 High [resolved 1.7.b] — `TaskItem` task title was `<div onClick>` with no role. Now `<button>` with `aria-label` = title + ", completed" when applicable.
- A11Y-19 Medium [resolved 1.7.b] — `TaskItem` toggle button had no `aria-label` / `aria-pressed`. Added `"Mark complete"` / `"Mark incomplete"` and `aria-pressed={task.completed}`.
- A11Y-20 Medium [resolved 1.7.b] — `TaskItem` memo was `<p onClick>`, image thumbnail was `<div onClick>`. Both now `<button>` with `aria-label="Open memo"` / `"View task photo"`. The `FileText` decorative icon on the right is `aria-hidden`.
- A11Y-21 High [resolved 1.7.b] — `CategorySection` category pill was `<div onClick>` with no role. Now `<button>` with `aria-expanded={isAdding}` and a label that names the category and visibility scope.
- A11Y-22 Medium [resolved 1.7.b] — inline add `<button>` with icon-only `<Plus>` had no label. Added `aria-label="Add task"`. The input gained a visually-hidden `<label>` (`sr-only`) associated via `useId` — the placeholder was the only cue.
- A11Y-23 Low [resolved 1.7.b] — visibility icon inside the pill is now `aria-hidden="true"` — the visibility scope is conveyed by the pill's `aria-label` instead.
- A11Y-28 High [resolved 1.7.b] — `DayCell` was `<motion.div onClick>`. Now `<motion.button type="button">` with `disabled={!onDayClick}` (cells in read-only contexts — e.g. friend calendar without click handler — are non-interactive), and `aria-label` including the full date, "today" when applicable, and the task count. Cell contents (`TaskBlock`s, day number) are `aria-hidden` since the label carries the information.
- A11Y-29 Low [resolved 1.7.b] — Month/Week day-of-week header rows (`Sun`/`Mon`/… and `EEE`) are now `aria-hidden="true"`. They are visual column labels; with buttons-as-cells there is no grid role for them to label, and announcing them separately would be noise.
- A11Y-30 Low [resolved 1.7.b] — `TaskBlock` documented as decorative; `title` attribute retained for pointer tooltips; `aria-hidden` wrapper provided by `DayCell` prevents double-announcement. No ARIA added to the block itself.
- A11Y-31 Low [resolved 1.7.b] — `TaskActionSheet` icon-only controls (Edit/Delete grid) gained `aria-hidden` on icons (the visible text was already the accessible name) and `type="button"` on all controls; memo preview is now a `<button aria-label="Open memo">`; visibility row icons `aria-hidden`. Four stub actions (Set Alarm, Open Timer, Make It a Routine, Move to Backlog) keep their existing `alert('…coming soon')` — the AGENTS §10 rule permits `alert()` for "Coming Soon" placeholders, and replacing them with a toast is a §25.5 user-visible behavior change out of scope for this batch.
- A11Y-32 Low [resolved 1.7.b] — `TaskVisibilitySheet` option buttons gained `aria-pressed` reflecting their selected state (inherit / private / followers / public) and `aria-hidden` on decorative icons. `type="button"` added throughout.
- A11Y-33 Medium [non-finding] — `DayViewSheet`'s `Swiper` slide navigation has no keyboard path. It relies on the sheet's prev/next via… nothing — DayViewSheet has no prev/next controls; date navigation happens by swiping. This is a real gap but out of scope for (1): keyboard navigation of the calendar requires either prev/next buttons in the sheet header or arrow-key handling with roving tabindex, both of which are (2) work. Logged for Phase 4 alongside the calendar-grid decision. The `DayViewSheet` is reachable via the `DayCell` button, so a keyboard user can open any day; the gap is only in changing days once the sheet is open (Escape → pick another cell).
- Non-findings (verified correct): OFF-5, E2, E3, F4, F5, F6, G1, G2, G3, H1, H2, H3, I1–I7.
Decisions:
- [2026-09-17] Batch 1.6 scope: Q1=1, Q2=a, Q3=split by domain. → 1.6.
- [2026-09-17] Focus trap: local `useFocusTrap` hook, no new dependency. → 1.6.
- [2026-09-17] `Button variant="icon"` label obligation documented, not enforced. → 1.6.
- [2026-09-17] `MessageBubble` keyboard parity via `Enter` → action sheet. → 1.6 (decision), 1.7.a (implementation).
- [2026-09-17] `MessageBubble` accessible name and `aria-hidden` status row. → 1.7.a.
- [2026-09-17] `ReactionRow` chip label carries count. → 1.7.a.
- [2026-09-17] Batch 1.7.b calendar grid decision: Option (1) — buttons, no `role="grid"`. Rationale: (a) `role="grid"` over slide-windowed cells would announce empty rows because off-screen cells are not rendered; (b) the Embla carousel's prev/next buttons already provide keyboard-reachable month navigation; (c) each `DayCell` as a `<button>` with a full-date+count `aria-label` gives a keyboard user a complete path to any day's content. Grid semantics + roving tabindex deferred to Phase 4, where it can be designed together with the WCAG AA pass rather than retrofitted.
- [2026-09-17] Batch 1.7.b `DayCell` `disabled={!onDayClick}`. Rationale: cells in read-only contexts (friend calendar with no click handler) should not be focusable — a `<button disabled>` is removed from the tab order, which is the correct behavior.
- [2026-09-17] Batch 1.7.b `TaskBlock` stays decorative. Rationale: the cell's `aria-label` already carries the task count; announcing each block would double the traversals without adding information. `title` retained for pointer-hover.
- [2026-09-17] Batch 1.7.b `TaskActionSheet` stubs retain `alert()`. Rationale: §10 permits `alert()` for Coming Soon; converting to toast is a user-visible behavior change outside the accessibility scope.
Deferred:
- OFF-1 → blocked on H1 decision.
- OFF-3 local-image-queue half → separate batch.
- Realtime channel-level reconnection backoff → future batch.
- OFF-6 LRU cap with byte budget → Phase 3 (optimize).
- PWA update-prompt UI, `beforeinstallprompt` affordance → Phase 3.5+ feature work.
- Full WCAG AA audit (contrast, reduced-motion, landmarks, skip link) → Phase 4 meta-audit.
- Calendar grid semantics + roving tabindex, `DayViewSheet` keyboard day navigation (A11Y-33) → Phase 4.
LastApply: 2026-09-17 — feat: accessibility — message surfaces (bubble keyboard activation, reaction chip labels, composer/search labels)
LastAuditSummary: Batch 1.7.b shipped — task/calendar surfaces. `DayCell` is now a `<button>` with full-date+count `aria-label`, disabled when non-interactive; month/week day-of-week rows `aria-hidden`; `TaskBlock` documented as decorative. `TaskItem` title/toggle/memo/image are `<button>`s with labels and `aria-pressed` on the toggle. `CategorySection` pill is a `<button>` with `aria-expanded` + visibility-scoped label; inline add button labeled; new-task input labeled via `sr-only`. `TaskActionSheet` and `TaskVisibilitySheet` icons `aria-hidden`, `aria-pressed` on visibility options, `type="button"` throughout. `DayViewSheet` keyboard day-navigation gap (A11Y-33) logged for Phase 4.
