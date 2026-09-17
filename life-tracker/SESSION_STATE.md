# SESSION STATE

Updated: 2026-09-18T00:00:00Z
ActivePlan: Phase 2 refactor audit → refactor
CurrentBatch: 4 of N
CurrentTask: Phase 2 execution plan (batch 2.5+ scoping) — audits 2.2 / 2.3 / 2.4 are CLOSED
Status: in_progress
NextAction: Chat 1 produces the batch 2.5+ execution plan (ordering + batch breakdown) from the closed 2.2/2.3/2.4 findings. No execution until that plan is written.
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
  - [ ] 2.5+ Refactor execution batches (scoped by 2.2–2.4 findings) — plan being produced
- [ ] Phase 3 — optimize audit → optimize (bundle 1.7 MB, route splitting, lazy images; receives OFF-6 LRU cap)
- [ ] Phase 4 — spec audit group (meta-audit of AGENTS.md, discovery, enforcement; receives full WCAG AA audit + calendar grid semantics + DayViewSheet keyboard day-navigation A11Y-33)
- [ ] Feature work — Phase 3.5 Todo List, 3.6 Diary, 3.7 Notifications, API integrations (paused)
OpenQuestions: none
Findings:
- DUP-1 [High] `src/lib/messageActionQueue.ts` + `src/lib/socialOutbox.ts` are near-identical persistent retry queues (~250 LOC each; same load/save/dedup/retry/drop/flush shape, same `setXSender`/`enqueueX`/`flushX`/`clearX`/`getXSize`/`__resetXForTests` exports). Fix: extract `createPersistentOutbox<T>()` in `src/lib/outbox.ts`; both become thin configs; social's revert + failure-event behavior becomes an optional decorator.
- DUP-2 [High] `useTasks`/`useCategories`/`useDiary`/`useSettings` share the RxDB subscription scaffold (user-scoped guard, `isMounted` flag, `query.$.subscribe`, `isLoading`). Fix: extract `useRxCollection<T>(name, query?, sort?)`; domain hooks layer their mutators on top.
- DUP-3 [Medium] `src/components/home/views/CalendarBody.tsx` + `src/components/friend/FriendCalendarView.tsx` duplicate slide rendering, `tasksByDate` memo, and Embla plumbing. Fix: extract `<CalendarSlides>` shared shell; per-slide callback divergence stays as props.
- DUP-4 [Medium] Render-body reset pattern copy-pasted in 11 files. Fix: `usePropSync(key, onReset)` hook — verify against §9 canonical pattern before executing.
- DUP-5 [Medium] Feedback toast pattern duplicated in 5 places. Fix: `useFeedback()` + `<Toast>` primitive per §10 styling.
- DUP-6 [Medium] Delete-confirm nested `BottomSheet` in 3 places. Fix: `<ConfirmSheet>` primitive with `isLocked={true}` + two-button footer.
- DUP-7 [Medium] `ImagePickerSheet.tsx` + `EditProfileImageSheet.tsx` near-identical. Fix: `<ImageUploadField>` component.
- DUP-8 [Low] 5 form sheets share shape. Fix: `<FormSheet>` primitive — evaluate over-abstraction risk; SetUsername's §23.6 offline branch is the divergence.
- DUP-9 [Low] `formatRelative` duplicated (`ConversationRow.tsx`, `SyncStatusSheet.tsx`). Fix: move to `src/lib/format.ts`.
- DUP-10 [Low] `getVisibilityIcon` implemented in 3–5 sites. Fix: single helper in `src/lib/visibility.ts`.
- DUP-11 [Low] Spinner markup inlined everywhere despite §14 declaring the primitive. Fix: `<Spinner size={N} />`.
- DUP-12 [Low] Empty-array constants not centralized. Fix: `src/constants/empty.ts`.
- CB-1 [High] `PersonPane` mounts `useMessages(friendId)` per friend pane solely for `sendTaskReaction`. Violates §16 rule 12. Fix: subscription-free `sendOutgoingMessage` lib function (see HB-9); drop `useMessages` from `PersonPane`.
- CB-2 [High] `DayViewSheet.tsx` is a ~370-line god component. Fix: extract `useDayViewSheetState` + `useDayTaskActions`; split `<DayNavHeader>`, `<DayDeletePhotoConfirm>`. Defer until DUP-4/5/6 primitives land.
- CB-3 [High] `ChatPage.tsx` is a ~580-line god page. Fix: split into `useChatScroll`, `useChatRenderItems`, `useChatSearch`, `useChatOverlays`, `<UnsendConfirmSheet>`. Defer until DUP-5/6 primitives land.
- CB-4 [Medium] Stale-document snapshots across sheets (`activeTask`, `actionMessage`, `unsendTarget`, `reactionTarget`). Fix: store IDs, derive documents from live array.
- CB-5 [Medium] `ChatPage` derives `myUserId` from `messages.find(...)`. Fix: `useAuth().user?.$id`.
- CB-6 [Medium] Inline Cancel/Delete footers bypass `Button` primitive. Fix: superseded by DUP-6's `<ConfirmSheet>`.
- CB-7 [Medium] `PersonPane` render-body side effect not matching §9 pattern. Fix: apply §9 render-body reset key.
- CB-8 [Medium] `CategoryManagerSheet` mixes three patterns (render-body `wasOpen` transition, `categoryByIdRef` mirror, un-`useCallback`-wrapped handlers). Fix: consolidate; audit the ref mirror.
- CB-9 [Medium] `TaskItem` inline edit input uses `autoFocus` inside Swiper/AnimatePresence/BottomSheet (§17 anti-pattern). Fix: `useRef` + `useEffect` on `isEditing`.
- CB-10 [Low] `MessageBubble` duplicates status/timestamp row JSX between unsent tombstone and normal bubble. Fix: extract `<StatusRow>`.
- CB-11 [Low] `CategoryManagerSheet.VisibilityIcon` local helper duplicates DUP-10. Fix: use shared helper.
- CB-12 [Low] Owner-side `ReactionRow` in `TaskItem` renders interactive toggle with no-op handler. Fix: add `readOnly` prop.
- CB-13 [Low] `ChatPage` three near-identical `toggleReaction`+feedback wrappers. Fix: collapse to one `handleReact`.
- CB-14 [Low] Dead cleanup inside `useCallback` in `DayViewSheet.handlePrevDay` / `handleNextDay`: `return () => cancelAnimationFrame(raf)` is discarded. Fix: remove.
- HB-1 [High] `useMessages` contains three near-identical outgoing-message builders (`sendMessage`, `sendTaskReply`, `sendTaskReaction`) — ~80 lines each, differing only in 4 field assignments (taskRef*, replyTo*). ~180 LOC collapse. Fix: single `buildOutgoingMessage(uid, friendId, tid, overrides)` helper.
- HB-2 [High] `useMessages.toggleReaction` is ~110 lines mixing: online check, optimistic patch, CONFLICT retry, delivery wait, revert-on-timeout, remote call, backfill, catch-revert. Fix: extract sub-helpers `applyOptimisticReaction`, `waitForDeliveryOrTimeout`, `revertIfStillPending`, `backfillPeerRowId`.
- HB-3 [High] DUP-2 confirmed at file level: `useTasks` / `useCategories` / `useDiary` / `useSettings` duplicate the ~40-line RxDB subscription scaffold verbatim. Fix: extract `useRxCollection<T>(collectionName, selector, sort)`; the four hooks become thin wrappers, ~160 LOC collapse.
- HB-4 [Medium] `useFriendCalendar` has two code paths doing the same fetch+error-classify: the `load` useCallback and the mount useEffect body. Fix: call `load()` from the effect with a mounted-check wrapper.
- HB-5 [Medium] `useMyProfile` same as HB-4 — `load` useCallback and useEffect body duplicate fetch + setProfile + error path. Fix: consolidate to `load`.
- HB-6 [Medium] `useDiary.saveEntry` and `useSettings.setSetting` use `doc.patch` while §10 / the codebase standard for multi-writer rows is `doc.incrementalPatch` (see `useCategories.updateCategory`/`reorderCategories`). `patch` throws CONFLICT and is lost on sync-cycle races; `incrementalPatch` merges. Fix: standardize on `incrementalPatch` for user-data rows.
- HB-7 [Medium] `useDiary` row ID `${uid}_${date}` uses raw concatenation without the `makeSettingsRowId`-style length guard. Violates §6 row cap when userId > 25 chars. Fix: introduce `makeDiaryRowId(uid, date)` in `src/lib/settingsRowId.ts` (or a shared `makeRowId`) with the same hash fallback.
- HB-8 [Medium] Write-side upsert-or-insert pattern (find-one → patch if exists else insert) duplicated between `useSettings.setSetting` and `useDiary.saveEntry`. Fix: extract `upsertLocalDoc(collection, id, doc)` helper (RxDB-level, not React).
- HB-9 [Medium] `useMessages` couples read (thread subscription) and write (`sendMessage`, `sendTaskReply`, `sendTaskReaction`) concerns. Read-only consumers (`PersonPane`, CB-1) are forced to open a subscription they never use. Fix: extract a subscription-free `sendOutgoingMessage(friendId, overrides)` lib function (or `useSendMessage` with no subscription); structural fix for CB-1.
- HB-10 [Low] `useProfile` is a thin wrapper over `useSettings` — 4 mutators each calling `setSetting('key', value)`. Zero added value beyond defaults. Fix: candidate for inlining at call sites, or fold into `useSettings`.
- HB-11 [Low] `useFriendCarousel` bio backfill runs serially (one `await fetchProfileByUserId` per missing friend). For 20 friends this is 20 sequential network calls on mount. Fix: `Promise.allSettled` with bounded concurrency.
- HB-12 [Low] `useCategories.reorderInProgress` module-level guard silently returns on collision (two sheets reordering concurrently — second call drops). Correct behavior but no DEV-level log. Fix: `if (DEBUG) console.warn('[useCategories] reorder skipped: already in progress')`.
Decisions:
- [2026-09-17] H1 = Option A: hydrate `user` from persisted last-known identity on mount-time network error; render app tree with offline banner; clear cache on explicit `logout()` and on confirmed 401 (never on network error). → shipped in batch 2.1.
- [2026-09-17] Phase 1 close: all ten batches shipped. Chat 1 trimmed CHORE-G/OFF/RT/ERR/STO/PWA/A11Y finding IDs from SESSION_STATE and inlined the Phase 1 outcomes into the Changelog row and AGENTS.md §8. §25.11 protocol followed.
- [2026-09-17] Dangling cross-refs removed from AGENTS.md: D8 (§0 item 4, §6), F12 (§12), F13 (§10), F17 + D4 (§18). None resolved to current state or a Changelog row; rule text stands alone.
- [2026-09-17] Duplication sweep (2.2) records findings only — no code changes in this batch. Execution scoped after 2.3 + 2.4 audits close.
- [2026-09-17] Component boundary audit (2.3) records findings only. CB-2 and CB-3 (god-component splits) deferred until DUP-4/5/6 primitives land — extracting `usePropSync`, `<Toast>`, `<ConfirmSheet>` first shrinks the extracted-hook surface and avoids re-refactoring.
- [2026-09-18] Hook boundary audit (2.4) records findings only. Execution order re-confirmed: shared primitives (DUP-1/2/4/5/6/9/10/11/12) → hook-level extractions (HB-1/2/3/4/5/8/9) → god-component splits (CB-2/3). HB-9 supersedes CB-1's "drop useMessages from PersonPane" — same structural fix.
Deferred:
- OFF-1 → Phase 2 batch 2.1 (H1 = Option A) — SHIPPED 2026-09-17.
- OFF-3 local-image-queue half → separate batch (IndexedDB blob queue for image uploads).
- Realtime channel-level reconnection backoff → future batch.
- OFF-6 LRU cap with byte budget → Phase 3 (optimize).
- PWA update-prompt UI, `beforeinstallprompt` affordance, `ProfilePage` Share wiring → Phase 3.5+ feature work.
- Full WCAG AA audit (contrast, reduced-motion, landmarks, skip link) → Phase 4 meta-audit.
- Calendar grid semantics + roving tabindex, `DayViewSheet` keyboard day navigation (A11Y-33) → Phase 4.
LastApply: 2026-09-17 — docs: phase 2 batch 2.3 audit — component boundary findings
LastAuditSummary: Phase 1 CLOSED. Phase 2 batch 2.1 shipped (OFF-1 offline auth gate). Batches 2.2 / 2.3 / 2.4 CLOSED with 12 + 14 + 12 findings (38 total). Execution order decided: shared primitives (DUP) → hook extractions (HB) → god-component splits (CB). 2.5+ execution plan in production.
