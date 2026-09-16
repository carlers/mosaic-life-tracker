# SESSION STATE

Updated: 2026-09-17T00:00:00Z
ActivePlan: Phase 1 audits — final sweep
CurrentBatch: 4 of 6
CurrentTask: 1.4 Item 7 residual — storage/imageCache consolidation (absorbs OFF-6, OFF-7)
Status: in_progress
NextAction: Run `npm run apply`, then continue to 1.5 Item 11 (PWA / service worker).
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
  - [ ] 1.5 Item 11 — PWA / service worker
  - [ ] 1.6 Item 13 — accessibility
- [ ] Phase 2 — refactor audit → refactor
- [ ] Phase 3 — optimize audit → optimize (bundle 1.7 MB, route splitting, lazy images; receives OFF-6 LRU cap)
- [ ] Phase 4 — spec audit group (meta-audit of AGENTS.md, discovery, enforcement)
- [ ] Feature work — Phase 3.5 Todo List, 3.6 Diary, 3.7 Notifications, API integrations (paused)
OpenQuestions:
- H1 — offline auth gate (OFF-1). §1 claims "100% offline functionality"; §23.6 maps network error → `user: null` → retry screen. Product/architecture decision required before Chat 2 can fix OFF-1. Options: (a) hydrate user from cached identity on network failure; (b) rename retry screen to an offline-mode screen with local read-only access; (c) accept behavior and downgrade §1's claim in docs.
Findings:
- CHORE-G-1 through CHORE-G-5 — AGENTS.md compression follow-up items (resolved).
- OFF-1 Critical — Offline cold launch blocks access to local data. Blocked on H1.
- OFF-2 Medium [RESOLVED 1.1.fix.b] — Spurious `auth:unauthorized` on cold-load-without-session.
- OFF-3 High — Image upload offline discards the compressed blob. [resolved 1.1.fix — error-message fix only; local image queue deferred]
- OFF-4 Low [RESOLVED 1.1.fix.b] — `messageActionQueue` cap drop now logs each drop.
- OFF-6 Low [RESOLVED 1.4 — documented only] — `imageCache` has no eviction bound. Documented in `src/lib/imageCache.ts` header with a §18 cross-reference. Rationale: images ≤150KB compressed (§4), so a heavy user with a few hundred images is in the low tens of MB — well under the iOS IndexedDB quota. LRU cap with byte budget deferred to Phase 3 (optimize) so it can be sized against real cache-growth data.
- OFF-7 Info [RESOLVED 1.4] — `src/lib/imageCache.ts` duplicated `src/lib/storage.ts`'s private cache implementation. `imageCache.ts` is now the single source of truth: `storage.ts` imports `getCachedImage`/`cacheImage`/`deleteCachedImage` from it; its private `openCacheDB`/`getCachedImage`/`cacheImage`/`deleteCachedImage` are deleted. Q1 from the batch brief confirmed both files opened the *same* DB (`mosaic_image_cache`) and store (`blobs`) with byte-identical implementations, so the dedup is a pure refactor — no behavior change. `exportData.ts` was already importing from `imageCache.ts`.
- OFF-8 High [resolved 1.1.fix] — `sendFriendRequest` offline silently loses the reciprocal row.
- OFF-9 High [resolved 1.1.fix] — `acceptFriendRequest`/`deleteFriendPair`/`blockFriend` offline lose the reciprocal update.
- OFF-10 Medium [resolved 1.1.fix] — Profile create/update requires network with no local queue.
- OFF-11 High [resolved 1.1.fix.b] — Cached friend data hidden by a transient refetch error.
- OFF-12 Low [resolved 1.1.fix.b] — Export offline now surfaces missing-image count.
- OFF-13 Low [resolved 1.1.fix.b] — Reaction toggle offline returns `'timeout'`.
- RT-1 through RT-4 [resolved 1.2] — Realtime layer shipped (Option A).
- ERR-1 through ERR-4 [resolved 1.3] — Error boundaries shipped (Option 3).
- STO-1 Info [resolved 1.4] — `imageCache.ts` is now the single owner of the `mosaic_image_cache` IndexedDB. `storage.ts` and `exportData.ts` both consume it. New unit tests pin the round-trip / delete / overwrite semantics.
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
- [2026-09-17] Batch 1.3 scope: Option 3 (top-level + per-route boundaries). → 1.3.
- [2026-09-17] `ErrorBoundary` is a class component with `[ErrorBoundary:<label>]` log prefix. → 1.3.
- [2026-09-17] `App.tsx` restructured: `AppWithErrorBoundary` is the default export; `App` is a named export. → 1.3.
- [2026-09-17] Batch 1.4 scope: (a) `storage.ts` imports the cache trio from `imageCache.ts` and drops its private copies; `imageCache.ts` is the single owner of the `mosaic_image_cache` IDB. (b) OFF-6 handled by documentation only — LRU cap deferred to Phase 3. Rationale: images ≤150KB compressed (§4); iOS quota ~1GB/origin; adding an LRU budget now means guessing a number with no real-growth data. → 1.4.
Deferred:
- OFF-1 → blocked on H1 decision.
- OFF-3 local-image-queue half → separate batch.
- Realtime channel-level reconnection backoff → future batch.
- OFF-6 LRU cap with byte budget → Phase 3 (optimize).
LastApply: 2026-09-17 — fix: drop unused React default import from ErrorBoundary
LastAuditSummary: Batch 1.4 shipped — `imageCache.ts` is now the single owner of the blob cache; `storage.ts` and `exportData.ts` both consume it. OFF-6 resolved by documentation with a Phase 3 deferral note. New `tests/unit/imageCache.test.ts` pins the round-trip / delete / overwrite semantics (4 tests).
