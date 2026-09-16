# SESSION STATE

Updated: 2026-09-17T00:00:00Z
ActivePlan: Phase 1 audits — final sweep
CurrentBatch: 3 of 6
CurrentTask: 1.3 Item 12 — error boundaries / crash resilience
Status: in_progress
NextAction: Run `npm run apply`, then continue to 1.4 Item 7 residual (storage/imageCache consolidation, receives OFF-7).
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
  - [ ] 1.4 Item 7 residual — storage/imageCache consolidation (receives OFF-7)
  - [ ] 1.5 Item 11 — PWA / service worker
  - [ ] 1.6 Item 13 — accessibility
- [ ] Phase 2 — refactor audit → refactor
- [ ] Phase 3 — optimize audit → optimize (bundle 1.7 MB, route splitting, lazy images)
- [ ] Phase 4 — spec audit group (meta-audit of AGENTS.md, discovery, enforcement)
- [ ] Feature work — Phase 3.5 Todo List, 3.6 Diary, 3.7 Notifications, API integrations (paused)
OpenQuestions:
- H1 — offline auth gate (OFF-1). §1 claims "100% offline functionality"; §23.6 maps network error → `user: null` → retry screen. Product/architecture decision required before Chat 2 can fix OFF-1. Options: (a) hydrate user from cached identity on network failure; (b) rename retry screen to an offline-mode screen with local read-only access; (c) accept behavior and downgrade §1's claim in docs.
Findings:
- CHORE-G-1 through CHORE-G-5 — AGENTS.md compression follow-up items (see prior state; resolved).
- OFF-1 Critical — Offline cold launch blocks access to local data. Blocked on H1.
- OFF-2 Medium [RESOLVED 1.1.fix.b] — Spurious `auth:unauthorized` fires on cold-load-without-session.
- OFF-3 High — Image upload offline discards the compressed blob. [resolved 1.1.fix — error-message fix only; local image queue deferred]
- OFF-4 Low [RESOLVED 1.1.fix.b] — `messageActionQueue` cap drop is silent. Now logs each drop.
- OFF-6 Low — `imageCache` has no eviction bound. Deferred to 1.4.
- OFF-7 Info (DEFERRED to 1.4) — `src/lib/imageCache.ts` duplicates `src/lib/storage.ts`'s private cache implementation.
- OFF-8 High [resolved 1.1.fix] — `sendFriendRequest` offline silently loses the reciprocal row.
- OFF-9 High [resolved 1.1.fix] — `acceptFriendRequest`/`deleteFriendPair`/`blockFriend` offline lose the reciprocal update.
- OFF-10 Medium [resolved 1.1.fix] — Profile create/update requires network with no local queue.
- OFF-11 High [resolved 1.1.fix.b] — Cached friend data hidden by a transient refetch error.
- OFF-12 Low [resolved 1.1.fix.b] — Export offline now surfaces missing-image count.
- OFF-13 Low [resolved 1.1.fix.b] — Reaction toggle offline returns `'timeout'`.
- RT-1 through RT-4 [resolved 1.2] — Realtime layer shipped (Option A).
- ERR-1 High [resolved 1.3] — No error boundary existed anywhere. A render-time throw in any page unmounted the entire React tree, leaving a white screen with no recovery path and no log in production (React suppresses its own error logging in prod builds). Resolved with a class `ErrorBoundary` primitive plus a `RouteErrorBoundary` wrapper applied to every route.
- ERR-2 Medium [resolved 1.3] — `App.tsx` exported `App` as default with the router inside. The top-level boundary must wrap the router, not the other way around — otherwise a router-transition crash bypasses the boundary. Restructured: `AppWithErrorBoundary` is the new default export; `App` is a named export. `main.tsx` imports the default.
- ERR-3 Medium [resolved 1.3] — A boundary without a reset path traps the user. Added two: a "Try again" button (resets local error state), and `resetKey={location.pathname}` on the per-route boundary (navigation clears the error, so leaving a broken route is always possible via the bottom nav). `onBack` navigates to `/home`, which is RxDB-backed and cannot depend on network.
- ERR-4 Low [resolved 1.3] — `main.tsx` had no boundary around `<AuthProvider>`; an `AuthProvider` render-time throw would take down the app. Wrapped with `<ErrorBoundary label="auth">`.
- Non-findings (verified correct): OFF-5, E2, E3, F4, F5, F6, G1, G2, G3, H1, H2, H3, I1–I7.
Decisions:
- [2026-09-16] Chat 1 may emit docs-only mega files directly. → chore-c.
- [2026-09-16] §25.6 example block uses 3 backticks; should be 4. [resolved 2026-09-17 in chore-f]
- [2026-09-16] OFF-7 routed to batch 1.4. → Deferred.
- [2026-09-16] SESSION_STATE.md is the phase's single document. → chore-d.
- [2026-09-16] Permanent-failure UX for OFF-8/9: revert local RxDB patch via `FriendsProvider`. → 1.1.fix.
- [2026-09-16] OFF-10 offline UX: enqueue + throw `OfflineError`. → 1.1.fix.
- [2026-09-16] OFF-3 image-queue deferral: only error-message fix ships. → Deferred.
- [2026-09-17] Chat 2 must append post-batch instructions (§25.8). → chore-e.
- [2026-09-17] §25.9 reasoning discipline added. → chore-e.
- [2026-09-17] `npm run apply*` copies output to clipboard on exit. → chore-e.
- [2026-09-17] OQ1–OQ6 from chore-f. → chore-f.
- [2026-09-17] §0 dedup follow-up. → chore-f.
- [2026-09-17] CHORE-G rationale (five items). → chore-g.
- [2026-09-17] OFF-11 UX: single non-blocking banner above the calendar. → 1.1.fix.b.
- [2026-09-17] OFF-13 UX: pre-check `navigator.onLine === false` and return `'timeout'`. → 1.1.fix.b.
- [2026-09-17] OFF-12 UX: extend success toast with missing-image count. → 1.1.fix.b.
- [2026-09-17] OFF-2 fix: raw `account` client in `resolveAuthenticatedUserId`. → 1.1.fix.b.
- [2026-09-17] OFF-4 fix: `console.warn` per dropped entry in `enqueueMessageAction`. → 1.1.fix.b.
- [2026-09-17] Batch 1.2 scope: Option A (full realtime layer over all six tables). → 1.2.
- [2026-09-17] Realtime application policy mirrors sync pull loop. → 1.2.
- [2026-09-17] Realtime lifecycle owned by `AppLayout`; `guardedRealtime.subscribe` returns plain `() => void`. → 1.2.
- [2026-09-17] Batch 1.3 scope: Option 3 (top-level + per-route boundaries). Rationale: per-route alone leaves `AppLayout`/route-transition crashes uncovered; top-level alone gives a full-screen crash card with no navigation. Together, the top-level is the last resort and per-route containment keeps the bottom nav alive. → 1.3.
- [2026-09-17] `ErrorBoundary` is a class component (React has no hook equivalent for `getDerivedStateFromError`). Log prefix `[ErrorBoundary:<label>]` distinguishes nested boundaries. Reset path: `Try again` (local) + `resetKey` (route change) + `onBack` (`/home`). No stack trace in UI. → 1.3.
- [2026-09-17] `App.tsx` restructured: `AppWithErrorBoundary` is the default export (wraps `<App />` in the root boundary); `App` is a named export. `main.tsx` adds `<ErrorBoundary label="auth">` around `<AuthProvider>` because a crash in the provider would otherwise take down the app before any route boundary exists. → 1.3.
Deferred:
- OFF-7 → batch 1.4 (imageCache consolidation).
- OFF-1 → blocked on H1 decision.
- OFF-3 local-image-queue half → separate batch.
- Realtime channel-level reconnection backoff → future batch.
LastApply: 2026-09-17 — fix: correct realtime import path and Appwrite subscribe return type
LastAuditSummary: Batch 1.3 shipped — `ErrorBoundary` class primitive + `RouteErrorBoundary` wrapper on all nine routes + root boundary + auth boundary. Crash containment verified by 7 component tests.
