# SESSION STATE

Updated: 2026-09-17T00:00:00Z
ActivePlan: Phase 2 refactor audit → refactor
CurrentBatch: 1 of N
CurrentTask: Batch 2.2 — refactor audit (duplication sweep)
Status: in_progress
NextAction: User types OFFBOARD to hand off to Chat 1 for batch 2.2 (refactor audit — duplication sweep).
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
  - [ ] 2.2 Refactor audit — duplication sweep
  - [ ] 2.3 Refactor audit — component boundary audit
  - [ ] 2.4 Refactor audit — hook boundary audit
  - [ ] 2.5+ Refactor execution batches (scoped by 2.2–2.4 findings)
- [ ] Phase 3 — optimize audit → optimize (bundle 1.7 MB, route splitting, lazy images; receives OFF-6 LRU cap)
- [ ] Phase 4 — spec audit group (meta-audit of AGENTS.md, discovery, enforcement; receives full WCAG AA audit + calendar grid semantics + DayViewSheet keyboard day-navigation A11Y-33)
- [ ] Feature work — Phase 3.5 Todo List, 3.6 Diary, 3.7 Notifications, API integrations (paused)
OpenQuestions: none
Findings: OFF-1 resolved (batch 2.1). `AuthProvider` hydrates `user` from `localStorage['mosaic_last_known_user']` on mount-time network error, sets `isOffline: true`, and lets `AppLayout` fall through to the app tree (MainLayout shows OfflineBanner). Cache cleared only on explicit `logout()` and confirmed 401 — never on a network error. Consumer audit of all `useAuth` importers (AppLayout, ConversationsProvider, FriendsProvider, useTasks, useCategories, useDiary, useSettings, useMessages, useMyProfile, useProfileLookup, useFriendCalendar, DayViewSheet, PersonPane, SetUsernameSheet, ChangeEmailSheet, ChangePasswordSheet, ExportDataSheet, AccountPage, SettingsPage, AuthPage, FriendCalendarPage): no new breakages that require fixing this batch. RxDB readers subscribe to local data only. Server-touching consumers already distinguish offline from 401: `useMyProfile` surfaces an offline error state, `useFriendCalendar` exposes `errorKind: 'offline'`, `useMessages` delivery queues via `messageActionQueue`, `SetUsernameSheet` branches on `isOfflineError`, `ExportDataSheet` degrades gracefully on blob-fetch failure. No consumer treats `user !== null` as proof of a live server session.
Decisions:
- [2026-09-17] H1 = Option A: hydrate `user` from persisted last-known identity on mount-time network error; render app tree with offline banner; clear cache on explicit `logout()` and on confirmed 401 (never on network error). Implemented batch 2.1.
- [2026-09-17] Phase 1 close: all ten batches shipped. Chat 1 trimmed CHORE-G/OFF/RT/ERR/STO/PWA/A11Y finding IDs from SESSION_STATE and inlined the Phase 1 outcomes into the Changelog row and AGENTS.md §8. §25.11 protocol followed.
- [2026-09-17] Dangling cross-refs removed from AGENTS.md: D8 (§0 item 4, §6), F12 (§12), F13 (§10), F17 + D4 (§18). None resolved to current state or a Changelog row; rule text stands alone.
Deferred:
- OFF-3 local-image-queue half → separate batch (IndexedDB blob queue for image uploads).
- Realtime channel-level reconnection backoff → future batch.
- OFF-6 LRU cap with byte budget → Phase 3 (optimize).
- PWA update-prompt UI, `beforeinstallprompt` affordance, `ProfilePage` Share wiring → Phase 3.5+ feature work.
- Full WCAG AA audit (contrast, reduced-motion, landmarks, skip link) → Phase 4 meta-audit.
- Calendar grid semantics + roving tabindex, `DayViewSheet` keyboard day navigation (A11Y-33) → Phase 4.
LastApply: 2026-09-17 — fix: offline auth gate (OFF-1, H1 = Option A — cached user hydration)
LastAuditSummary: Phase 1 CLOSED — ten batches shipped across offline audit, realtime, error boundaries, image cache consolidation, PWA/SW, four-part accessibility sweep. Sole carry-over OFF-1 (H1 = Option A) scheduled as Phase 2 batch 2.1.
