# SESSION STATE

Updated: 2026-09-17T12:00:00Z
ActivePlan: Phase 2 refactor audit → refactor
CurrentBatch: 2 of N
CurrentTask: Batch 2.3 — component boundary audit
Status: in_progress
NextAction: Continue Chat 1 in this session for batch 2.3 (component boundary audit). Do NOT start batch 2.5 execution until 2.3 + 2.4 audits close.
NextChatRole: chat1
BatchPlan:
- Phase 1 audits — CLOSED (all ten batches; sole carry-over OFF-1)
  - [x] 1.1 Item 10 — offline behavior audit
  - [x] 1.1.chore a–g — tooling + AGENTS.md compression
  - [x] 1.1.fix — offline write resilience (OFF-8, OFF-9, OFF-10, OFF-3 error-message only)
  - [x] 1.1.fix.b — cached-data rendering + small offline fixes (OFF-11, OFF-13, OFF-12, OFF-2, OFF-4)
  - [x] 1.2 Item 9 — realtime subscriptions layer (Option A: all six tables)
  - [x] 1.3 Item 12 — error boundaries / crash resilience (Option 3: top-level + per-route)
  - [x] 1.4 Item 7 residual — storage/imageCache consolidation (absorbs OFF-6, OFF-7)
  - [x] 1.5 Item 11 — PWA / service worker audit + fixes
  - [x] 1.6–1.7.c Item 13 — accessibility (four sub-batches; A11Y-33 deferred to Phase 4)
- Phase 2 refactor audit → refactor (current)
  - [x] 2.1 OFF-1 — offline auth gate (H1 = Option A)
  - [x] 2.2 Refactor audit — duplication sweep (12 findings DUP-1…DUP-12)
  - [ ] 2.3 Refactor audit — component boundary audit
  - [ ] 2.4 Refactor audit — hook boundary audit
  - [ ] 2.5+ Refactor execution batches (scoped by 2.2–2.4 findings)
- [ ] Phase 3 — optimize audit → optimize (bundle 1.7 MB, route splitting, lazy images; receives OFF-6 LRU cap)
- [ ] Phase 4 — spec audit group (meta-audit of AGENTS.md, discovery, enforcement; receives full WCAG AA audit + calendar grid semantics + DayViewSheet keyboard day-navigation A11Y-33)
- [ ] Feature work — Phase 3.5 Todo List, 3.6 Diary, 3.7 Notifications, API integrations (paused)
OpenQuestions: none
Findings:
- DUP-1 [High] `src/lib/messageActionQueue.ts` + `src/lib/socialOutbox.ts` are near-identical persistent retry queues (~250 LOC each; same load/save/dedup/retry/drop/flush shape, same `setXSender`/`enqueueX`/`flushX`/`clearX`/`getXSize`/`__resetXForTests` exports). Fix: extract `createPersistentOutbox<T>()` in `src/lib/outbox.ts`; both become thin configs; social's revert + failure-event behavior becomes an optional decorator.
- DUP-2 [High] `useTasks`/`useCategories`/`useDiary`/`useSettings` share the RxDB subscription scaffold (user-scoped guard, `isMounted` flag, `query.$.subscribe`, `isLoading`). Fix: extract `useRxCollection<T>(name, query?, sort?)`; domain hooks layer their mutators on top.
- DUP-3 [Medium] `src/components/home/views/CalendarBody.tsx` + `src/components/friend/FriendCalendarView.tsx` duplicate slide rendering, `tasksByDate` memo, and Embla plumbing. Fix: extract `<CalendarSlides>` shared shell; per-slide callback divergence stays as props.
- DUP-4 [Medium] Render-body reset pattern copy-pasted in 11 files (MemoSheet, DatePickerSheet, EditTaskSheet, DayViewSheet, ChangeEmailSheet, ChangePasswordSheet, EditNameSheet, EditDescriptionSheet, SetUsernameSheet, ExportDataSheet, useProfileLookup). Fix: `usePropSync(key, onReset)` hook — verify against §9 canonical pattern before executing.
- DUP-5 [Medium] Feedback toast pattern duplicated in 5 places (DayViewSheet `deleteFeedback`, ChatPage `feedback`, SettingsPage `showFeedback`, AccountPage `showFeedback`, ExplorePage `showFeedback`). Fix: `useFeedback()` + `<Toast>` primitive per §10 styling.
- DUP-6 [Medium] Delete-confirm nested `BottomSheet` in 3 places (DayViewSheet delete-photo, CategoryManagerSheet delete-category, ChatPage unsend). Fix: `<ConfirmSheet>` primitive with `isLocked={true}` + two-button footer.
- DUP-7 [Medium] `ImagePickerSheet.tsx` + `EditProfileImageSheet.tsx` near-identical (file input, compress+upload, spinner, remove, reset input value). Fix: `<ImageUploadField>` component.
- DUP-8 [Low] 5 form sheets (ChangeEmailSheet, ChangePasswordSheet, EditNameSheet, EditDescriptionSheet, SetUsernameSheet) share shape (local state, render-body reset on isOpen, `handleSave` async, spinner/disabled button, error). Fix: `<FormSheet>` primitive — evaluate over-abstraction risk; SetUsername's §23.6 offline branch is the divergence.
- DUP-9 [Low] `formatRelative` duplicated (`ConversationRow.tsx`, `SyncStatusSheet.tsx`). Fix: move to `src/lib/format.ts`.
- DUP-10 [Low] `getVisibilityIcon` implemented in 3–5 sites (`CategorySection.tsx`, `FriendDayViewSheet.tsx`, `CategoryManagerSheet.tsx`, likely `TaskActionSheet.tsx` and `TaskVisibilitySheet.tsx`). Fix: single helper in `src/lib/visibility.ts` alongside `labelForVisibility`.
- DUP-11 [Low] Spinner markup inlined everywhere despite §14 declaring the primitive. Fix: `<Spinner size={N} />` in `src/components/ui/`.
- DUP-12 [Low] Empty-array constants (`EMPTY_TASKS` and siblings per §16 rule 3) not centralized. Fix: `src/constants/empty.ts`.
Decisions:
- [2026-09-17] H1 = Option A: hydrate `user` from persisted last-known identity on mount-time network error; render app tree with offline banner; clear cache on explicit `logout()` and on confirmed 401 (never on network error). → shipped in batch 2.1.
- [2026-09-17] Phase 1 close: all ten batches shipped. Chat 1 trimmed CHORE-G/OFF/RT/ERR/STO/PWA/A11Y finding IDs from SESSION_STATE and inlined the Phase 1 outcomes into the Changelog row and AGENTS.md §8. §25.11 protocol followed.
- [2026-09-17] Dangling cross-refs removed from AGENTS.md: D8 (§0 item 4, §6), F12 (§12), F13 (§10), F17 + D4 (§18). None resolved to current state or a Changelog row; rule text stands alone.
- [2026-09-17] Duplication sweep (2.2) records findings only — no code changes in this batch. Execution scoped after 2.3 (component) + 2.4 (hook) audits close; a single execution batch plan is produced at that point. DUP-1 and DUP-2 are the top candidates for a first execution batch.
Deferred:
- OFF-1 → Phase 2 batch 2.1 (H1 = Option A) — SHIPPED 2026-09-17.
- OFF-3 local-image-queue half → separate batch (IndexedDB blob queue for image uploads).
- Realtime channel-level reconnection backoff → future batch.
- OFF-6 LRU cap with byte budget → Phase 3 (optimize).
- PWA update-prompt UI, `beforeinstallprompt` affordance, `ProfilePage` Share wiring → Phase 3.5+ feature work.
- Full WCAG AA audit (contrast, reduced-motion, landmarks, skip link) → Phase 4 meta-audit.
- Calendar grid semantics + roving tabindex, `DayViewSheet` keyboard day navigation (A11Y-33) → Phase 4.
LastApply: 2026-09-17 — feat: offline auth gate (OFF-1, batch 2.1)
LastAuditSummary: Phase 1 CLOSED. Phase 2 batch 2.1 shipped (OFF-1 offline auth gate). Batch 2.2 (duplication sweep) closed with 12 findings DUP-1…DUP-12 — 2 High, 6 Medium, 4 Low. Highest-value targets: DUP-1 (persistent-outbox factory, ~250 LOC collapse) and DUP-2 (`useRxCollection` scaffold, ~240 LOC collapse).
