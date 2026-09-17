# SESSION STATE

Updated: 2026-09-18T07:00:00Z
ActivePlan: Phase 2 refactor audit → refactor
CurrentBatch: 8 of 10
CurrentTask: Batch 2.8 — domain hook extractions
Status: in_progress
NextAction: Start Chat 2 for batch 2.9 — god-component splits: CB-1, CB-2, CB-3, CB-4, CB-5, CB-13, CB-14, DUP-3. Prompt must state DeepThink: OFF.
NextChatRole: chat2
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
  - [x] 2.3 Refactor audit — component boundary audit (14 findings CB-1…CB-14)
  - [x] 2.4 Refactor audit — hook boundary audit (12 findings HB-1…HB-12)
  - [x] 2.5 Lib-level extractions — DUP-1, DUP-9, DUP-10, DUP-12, HB-6, HB-7, HB-8
  - [x] 2.6 Shared React primitives + `useRxCollection` — DUP-2/HB-3, DUP-4, DUP-5, DUP-6, DUP-11
  - [x] 2.7 Sheet migrations — DUP-7, DUP-8, + usePropSync/useFeedback/ConfirmSheet migrations across 19 files
  - [x] 2.8 Domain hook extractions — HB-1, HB-2, HB-4, HB-5, HB-9, HB-10, HB-11, HB-12, + data hooks migrated to useRxCollection (HB-3/DUP-2)
  - [ ] 2.9 God-component splits — CB-1, CB-2, CB-3, CB-4, CB-5, CB-13, CB-14, DUP-3
  - [ ] 2.10 Cleanup pass — CB-6, CB-7, CB-8, CB-9, CB-10, CB-11, CB-12
- [ ] Phase 3 — optimize audit → optimize (bundle 1.7 MB, route splitting, lazy images; receives OFF-6 LRU cap)
- [ ] Phase 4 — spec audit group (meta-audit of AGENTS.md, discovery, enforcement; receives full WCAG AA audit + calendar grid semantics + DayViewSheet keyboard day-navigation A11Y-33)
- [ ] Feature work — Phase 3.5 Todo List, 3.6 Diary, 3.7 Notifications, API integrations (paused)
OpenQuestions: none
Findings:
- DUP-3 [Medium] `CalendarBody.tsx` + `FriendCalendarView.tsx` duplicate slide rendering / `tasksByDate` memo / Embla plumbing. → 2.9
- CB-1 [High] `PersonPane` mounts `useMessages(friendId)` per friend pane solely for `sendTaskReaction`. → 2.9 (structural fix: migrate to `useMessageActions` — the narrower hook now exists)
- CB-2 [High] `DayViewSheet.tsx` god component. → 2.9
- CB-3 [High] `ChatPage.tsx` god page. → 2.9
- CB-4 [Medium] Stale-document snapshots (`activeTask`, `actionMessage`, `unsendTarget`, `reactionTarget`). → 2.9
- CB-5 [Medium] `ChatPage` derives `myUserId` from messages (BUG: wrong on empty / first-incoming threads). → 2.9
- CB-6 [Medium] Inline Cancel/Delete footers bypass `Button` primitive. → 2.10 (superseded by DUP-6)
- CB-7 [Medium] `PersonPane` render-body side effect (BUG: setState-in-render). → 2.10
- CB-8 [Medium] `CategoryManagerSheet` mixes three patterns. → 2.10
- CB-9 [Medium] `TaskItem` inline edit uses `autoFocus` inside Swiper/AnimatePresence/BottomSheet (BUG: §17 anti-pattern). → 2.10
- CB-10 [Low] `MessageBubble` duplicates status/timestamp row JSX. → 2.10
- CB-11 [Low] `CategoryManagerSheet.VisibilityIcon` duplicates DUP-10. → 2.10
- CB-12 [Low] Owner-side `ReactionRow` toggle with no-op handler. → 2.10
- CB-13 [Low] `ChatPage` three near-identical `toggleReaction` wrappers. → 2.9
- CB-14 [Low] Dead cleanup inside `useCallback` in `DayViewSheet` (BUG: RAF never cancelled). → 2.9
Decisions:
- [2026-09-17] H1 = Option A (offline auth gate). → shipped in 2.1.
- [2026-09-17] Phase 1 close: all ten batches shipped. §25.11 protocol followed.
- [2026-09-17] Dangling cross-refs removed from AGENTS.md: D8, F12, F13, F17, D4.
- [2026-09-17] Duplication sweep (2.2) — findings only, no code changes.
- [2026-09-17] Component boundary audit (2.3) — findings only. CB-2/CB-3 deferred until DUP-4/5/6 primitives land.
- [2026-09-18] Hook boundary audit (2.4) — findings only.
- [2026-09-18] Execution plan (2.5–2.10) locked.
- [2026-09-18] 2.6 primitives are new files only — no migrations.
- [2026-09-18] 2.7 merges EditProfileImageSheet into ImagePickerSheet; extracts form-sheet helpers.
- [2026-09-18] 2.8 splits useMessages into useThreadMessages (read) + useMessageActions (write) but keeps useMessages as a byte-identical facade so no call sites change. CB-1's migration to the narrower `useMessageActions` in PersonPane/FriendCalendarPage lands in 2.9. `useProfile` kept as a typed wrapper (HB-10 disposition: keep, document). `useFriendCalendar` and `useMyProfile` share a `runFetch`/`runLoad` helper within their own file rather than a new module (the logic is file-local).
Deferred:
- OFF-3 local-image-queue half → separate batch.
- Realtime channel-level reconnection backoff → future batch.
- OFF-6 LRU cap → Phase 3.
- PWA update-prompt UI, `beforeinstallprompt`, `ProfilePage` Share wiring → Phase 3.5+.
- Full WCAG AA audit → Phase 4.
- Calendar grid semantics + A11Y-33 → Phase 4.
LastApply: 2026-09-18 — hooks: batch 2.8 domain hook extractions
LastAuditSummary: Batch 2.8 shipped. `useMessages` split into `useThreadMessages` (read) + `useMessageActions` (write) behind a byte-identical facade. Three outgoing-message builders collapsed into `messageComposer.ts` (HB-1). `toggleReaction` extracted to `messageReactions.ts` (HB-2). `useTasks`/`useCategories`/`useDiary`/`useSettings` migrated to `useRxCollection` (HB-3/DUP-2). `useFriendCalendar`/`useMyProfile` deduplicated their fetch paths (HB-4, HB-5). `useFriendCarousel` bio backfill parallelized with concurrency cap (HB-11). `useCategories.reorderInProgress` silent guard now logs (HB-12). `useProfile` kept as documented wrapper (HB-10). CB-1's PersonPane migration deferred to 2.9 as planned.
