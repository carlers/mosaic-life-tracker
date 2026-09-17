# SESSION STATE

Updated: 2026-09-17T18:00:00Z
ActivePlan: Phase 2 refactor audit → refactor
CurrentBatch: 3 of N
CurrentTask: Batch 2.4 — hook boundary audit
Status: in_progress
NextAction: Continue Chat 1 in this session for batch 2.4 (hook boundary audit). After 2.4 closes, produce the batch 2.5+ execution plan scoped by 2.2 (duplication), 2.3 (component), and 2.4 (hook) findings.
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
  - [x] 2.3 Refactor audit — component boundary audit (14 findings CB-1…CB-14)
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
- CB-1 [High] `PersonPane` mounts `useMessages(friendId)` per friend pane solely for `sendTaskReaction` — opens a full messages subscription (and the outbox/pending-delivery machinery) on every mounted carousel pane, for a write-only API. Violates §16 rule 12 (providers own subscriptions, hooks are selectors). Fix: extract `sendTaskReaction(task, emoji, color)` into a standalone lib function or a subscription-free hook; drop `useMessages` from `PersonPane`.
- CB-2 [High] `DayViewSheet.tsx` is a ~370-line god component. Owns: task CRUD orchestration, categories lookup, current user, image URL resolution, 8 sheet/modal open states (`isActionSheetOpen`, `isMemoSheetOpen`, `isDatePickerOpen`, `isVisibilitySheetOpen`, `viewingTask`, `imagePickerTask`, `isDeletePhotoConfirmOpen`, `isDeletingPhoto`), swipe navigation, editing state (`editingTaskId`, `editValue`), delete-photo state, feedback toast, and `isBackgroundLocked` aggregation. Fix: extract `useDayViewSheetState(selectedDate, onDateChange)` (navigation + `isBackgroundLocked` + active-task routing) and `useDayTaskActions()` (delete / memo / visibility / date / image handlers); split presentational sub-components `<DayNavHeader>`, `<DayDeletePhotoConfirm>`.
- CB-3 [High] `ChatPage.tsx` is a ~580-line god page. Owns: search state + filtered render-item memo, scroll pinning + FAB, poll interval, keydown handler, per-message status-map, overlay state (`isActionSheetOpen`, `isUnsendConfirmOpen`, `isEmojiPickerOpen`) plus 3 associated message snapshots (`actionMessage`, `unsendTarget`, `reactionTarget`), reply composer state, `myUserId` derivation, and 12+ callbacks. Fix: split into `useChatScroll(ref)` (pinning + FAB), `useChatRenderItems(messages, searchQuery, isSearching)` (dividers + timestamp grouping), `useChatSearch()`, `useChatOverlays()`, and presentational `<UnsendConfirmSheet>`; drop `useState`-in-render branching.
- CB-4 [Medium] Stale-document snapshots across sheets. `DayViewSheet` holds `activeTask: TaskDocument | null` and manually patching to keep it coherent (`setActiveTask(prev => prev ? { ...prev, image: '' } : null)` after `updateTask`); `ChatPage` holds `actionMessage`, `unsendTarget`, `reactionTarget` as message snapshots. RxDB updates to the underlying row do not propagate to these copies. Fix: store `activeTaskId` / `actionMessageId` / `unsendTargetId` and derive the current document from the live array via `useMemo` (`tasks.find(t => t.id === id)`, `messages.find(m => m.id === id)`).
- CB-5 [Medium] `ChatPage` derives `myUserId` from `messages.find(m => m.direction === 'outgoing')?.senderId || ''`. Fragile: empty thread or first-message-incoming both yield `''`, wrong `isOutgoing` on every subsequent render. Fix: read `useAuth().user?.$id`. Same value is already available; the derivation is redundant.
- CB-6 [Medium] Inline `<button>` markup for Cancel/Delete/Unsend confirmation footers in `DayViewSheet`, `ChatPage`, `CategoryManagerSheet`. Bypasses §14 `Button` primitive (no `focus-visible` ring beyond the ad-hoc one, no `whileTap`). Fix: superseded by DUP-6's `<ConfirmSheet>`; the footer buttons become `<Button variant="ghost" />` + `<Button variant="danger" />`.
- CB-7 [Medium] `PersonPane` render-body side effect: `if (!isMe && !isActive && activeView !== 'calendar') { setActiveView('calendar'); }`. Not the §9 "render-body reset" pattern (no synced key, unconditional branch). Fix: `const [syncedKey, setSyncedKey] = useState<string | null>(null); const wantedKey = \`${person.userId}:${isActive}\`; if (syncedKey !== wantedKey) { setSyncedKey(wantedKey); if (!isMe && !isActive) setActiveView('calendar'); }`.
- CB-8 [Medium] `CategoryManagerSheet` mixes three patterns: (a) render-body `wasOpen` transition for `localOrder` (line `if (isOpen !== wasOpen) { setWasOpen(isOpen); ... }`), (b) a `categoryByIdRef` mirror to keep the debounced reorder effect off the `categories` dep chain, (c) `handleUpdate` / `handleSaveNew` / `handleConfirmDelete` / `handleResetTasks` / `handleEditCancel` all un-wrapped (no `useCallback`, §9 violation). Fix: consolidate (a) into the same §9 render-body reset pattern (or DUP-4's `usePropSync`); audit (b) — the ref mirror is a symptom of the dep chain being too wide; wrap (c) in `useCallback`.
- CB-9 [Medium] `TaskItem` inline edit input uses `autoFocus` (line: `autoFocus` on `<input>` inside the `isEditing` branch). The input lives inside `Swiper` → `AnimatePresence` → `BottomSheet`, exactly the condition §17 calls out as the anti-pattern. Fix: `useRef` + `useEffect(() => { inputRef.current?.focus(); }, [isEditing])`.
- CB-10 [Low] `MessageBubble` duplicates the status/timestamp row JSX between the unsent tombstone and the normal bubble (~15 lines). Fix: extract `<StatusRow items={items} />` (a private sub-component in the same file).
- CB-11 [Low] `CategoryManagerSheet.VisibilityIcon` local helper duplicates the icon-per-visibility mapping (same class as DUP-10). Fix: use DUP-10's shared helper; the visibility toggle row renders 3× (edit row, add row, and per-category badge).
- CB-12 [Low] Owner-side `ReactionRow` in `TaskItem` renders an interactive toggle with a no-op handler (`onToggle={() => { /* Owner cannot toggle */ }}`). Semantic mismatch — the component exposes a tappable control that does nothing. Fix: add a `readOnly?: boolean` prop to `ReactionRow`; when true, render chips without `onToggle` handlers and without `whileTap`.
- CB-13 [Low] `ChatPage` has three near-identical `toggleReaction`+`feedback` wrappers: `handleReactFromSheet`, `handleEmojiPicked`, `handleBubbleReact`. All three call `toggleReaction(id, emoji).then(result => { if (result === 'timeout') setFeedback(...) }).catch(...)`. Fix: collapse to one `handleReact(messageId, emoji)`.
- CB-14 [Low] Dead cleanup inside `useCallback` in `DayViewSheet.handlePrevDay` / `handleNextDay`: `return () => cancelAnimationFrame(raf)` — `useCallback` discards the returned function; the RAF is never cancelled. Fix: remove the return (the RAF is a one-shot at the tail of the callback anyway).
Decisions:
- [2026-09-17] H1 = Option A: hydrate `user` from persisted last-known identity on mount-time network error; render app tree with offline banner; clear cache on explicit `logout()` and on confirmed 401 (never on network error). → shipped in batch 2.1.
- [2026-09-17] Phase 1 close: all ten batches shipped. Chat 1 trimmed CHORE-G/OFF/RT/ERR/STO/PWA/A11Y finding IDs from SESSION_STATE and inlined the Phase 1 outcomes into the Changelog row and AGENTS.md §8. §25.11 protocol followed.
- [2026-09-17] Dangling cross-refs removed from AGENTS.md: D8 (§0 item 4, §6), F12 (§12), F13 (§10), F17 + D4 (§18). None resolved to current state or a Changelog row; rule text stands alone.
- [2026-09-17] Duplication sweep (2.2) records findings only — no code changes in this batch. Execution scoped after 2.3 (component) + 2.4 (hook) audits close; a single execution batch plan is produced at that point. DUP-1 and DUP-2 are the top candidates for a first execution batch.
- [2026-09-17] Component boundary audit (2.3) records findings only. CB-2 and CB-3 (god-component splits) are deliberately deferred until DUP-4/5/6 primitives land — extracting `usePropSync`, `<Toast>`, and `<ConfirmSheet>` first shrinks the extracted-hook surface and avoids re-refactoring the same sheets twice. Execution order: primitives → hooks → component splits.
Deferred:
- OFF-1 → Phase 2 batch 2.1 (H1 = Option A) — SHIPPED 2026-09-17.
- OFF-3 local-image-queue half → separate batch (IndexedDB blob queue for image uploads).
- Realtime channel-level reconnection backoff → future batch.
- OFF-6 LRU cap with byte budget → Phase 3 (optimize).
- PWA update-prompt UI, `beforeinstallprompt` affordance, `ProfilePage` Share wiring → Phase 3.5+ feature work.
- Full WCAG AA audit (contrast, reduced-motion, landmarks, skip link) → Phase 4 meta-audit.
- Calendar grid semantics + roving tabindex, `DayViewSheet` keyboard day navigation (A11Y-33) → Phase 4.
LastApply: 2026-09-17 — docs: phase 2 batch 2.2 audit — duplication sweep findings
LastAuditSummary: Phase 1 CLOSED. Phase 2 batch 2.1 shipped (OFF-1 offline auth gate). Batches 2.2 (duplication) and 2.3 (component boundary) closed with 12 + 14 findings. Highest-value targets: DUP-1 (persistent-outbox factory), DUP-2 (`useRxCollection` scaffold), CB-2/CB-3 (god-component splits in `DayViewSheet` / `ChatPage`). Execution order decided: primitives → hooks → component splits.
