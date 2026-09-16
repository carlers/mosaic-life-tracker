# SESSION STATE

Updated: 2026-09-17T00:00:00Z
ActivePlan: Phase 1 audits — final sweep
CurrentBatch: 2 of 6
CurrentTask: 1.2 Item 9 — realtime subscriptions layer (Option A: all six tables)
Status: in_progress
NextAction: Run `npm run apply`, then continue to 1.3 Item 12 (error boundaries / crash resilience).
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
  - [ ] 1.3 Item 12 — error boundaries / crash resilience
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
- CHORE-G-1 — §18 Accepted Sync Engine Limitations: restored D1, D3, D7, F9-backoff, Social Outbox rationale paragraphs (each 2–3 sentences: what / what was tried / why rejected). Eliminated the pointer-to-changelog circular reference. §18 is now self-contained.
- CHORE-G-2 — §2: restored behavioral specs for planned Phase 3.5–3.7 views (Todo List color-only grid + dot selection + vertical list; Diary per-day entry + visibility; Notifications `<ComingSoon />` until wired) and permanent calendar layout alignment rules (Month/Week vertical alignment, Month→Week jump, week header single line, task block styling, day-of-week colors, today border). Phase 3.5–3.7 now has a spec.
- CHORE-G-3 — §16: dropped F1/F3/F5/F12/F13 IDs from rules 12–16. Rule text stands alone for cold readers; IDs were dangling once SESSION_STATE.md trims at phase close.
- CHORE-G-4 — §25.3: added migration note (new Chat 1 picking up mid-phase reads SESSION_STATE.md first, not Changelog; Changelog is an index, not a narrative). Closes the mid-audit migration gap without inflating the Changelog.
- CHORE-G-5 — §25.11 (new): Phase-Close Protocol. Five steps: trim state, update summary, verify no dangling cross-refs from AGENTS.md into trimmed state, add final Changelog row, confirm §18 Accepted Limitations rationale is intact. Prevents the F-ID and D1-pointer problems from recurring.
- OFF-1 Critical — Offline cold launch blocks access to local data. `AuthProvider.resolveInitialUser` sets `user: null, isOffline: true` on network error; `AppLayout` renders the retry screen when `!user && isOffline`; no branch renders the protected tree with a cached identity. All data is in IndexedDB and fully readable — the block is purely the live `account.get()` probe. Violates §1 ("100% offline functionality"). Fix direction: persist last-known user identity (localStorage or settings row); on mount-time network error, hydrate `user` from cache and set `isOffline: true`; render app tree with offline banner; clear cached identity on explicit logout or confirmed 401 (not on network error). DECISION PENDING (H1).
- OFF-2 Medium [RESOLVED in 1.1.fix.b] — Spurious `auth:unauthorized` fires on cold-load-without-session. `resolveAuthenticatedUserId` in `sync.ts` now uses the raw `account` client from `src/lib/appwrite.ts` (not `guardedAccount`), so sync no longer dispatches `auth:unauthorized` on a no-session 401.
- OFF-3 High — Image upload offline discards the compressed blob. [resolved 1.1.fix — error-message fix only: `getCurrentUserId` returns null on 401, throws `OfflineError` on network; local image queue deferred to a separate batch]
- OFF-4 Low [RESOLVED in 1.1.fix.b] — `messageActionQueue` cap drop is silent. `enqueueMessageAction` now `console.warn`s each dropped entry.
- OFF-6 Low — `imageCache` has no eviction bound. Fix direction: document in §18; optional LRU cap in future refactor.
- OFF-7 Info (DEFERRED to batch 1.4) — `src/lib/imageCache.ts` duplicates `src/lib/storage.ts`'s private cache implementation.
- OFF-8 High [resolved 1.1.fix] — `sendFriendRequest` offline silently loses the reciprocal row.
- OFF-9 High [resolved 1.1.fix] — `acceptFriendRequest`/`deleteFriendPair`/`blockFriend` offline lose the reciprocal update.
- OFF-10 Medium [resolved 1.1.fix] — Profile create/update requires network with no local queue.
- OFF-11 High [resolved 1.1.fix.b] — Cached friend data hidden by a transient refetch error. `PersonPane` and `FriendCalendarPage` now gate the blocking error UI on `tasks.length === 0`; cached tasks render with a non-blocking offline/"couldn't refresh" banner above the calendar.
- OFF-12 Low [resolved 1.1.fix.b] — Export offline now surfaces missing-image count in the success toast (`ExportDataSheet` reads `result.counts.missingImages`).
- OFF-13 Low [resolved 1.1.fix.b] — Reaction toggle offline now short-circuits at the top of `useMessages.toggleReaction` and returns `'timeout'`, reusing §21's existing "Couldn't send reaction. Try again." toast.
- RT-1 High [resolved 1.2] — No realtime layer; read receipts and incoming messages depended on `ChatPage`'s 30s poll + focus/online sync, giving a 90–120s worst-case delivery gap (§20.5). Option A selected: full realtime layer over all six tables.
- RT-2 Medium [resolved 1.2] — `client` was only constructed in `src/lib/appwrite.ts` and `sdk.ts`. Option A required a `guardedRealtime.subscribe` wrapper on the guarded SDK surface so no file outside `sdk.ts` touches `client` directly (ESLint boundary preserved).
- RT-3 Medium [resolved 1.2] — Realtime payloads must not be applied blindly: server-owned `read_at` on outgoing messages must be applied regardless of local-dirty state (§12), and all other fields must respect the local-newer-wins rule so a realtime update cannot clobber an unsynced local edit. `src/db/realtime.ts` mirrors the sync pull loop's read_at + updatedAt comparison.
- RT-4 Low [resolved 1.2] — Realtime lifecycle is tied to auth: subscriptions open in `AppLayout` on `user.$id` and close on sign-out / unmount. `startRealtime` is idempotent for the same user and closes previous subscriptions on a user switch.
- Non-findings (verified correct): OFF-5, E2, E3, F4, F5, F6, G1, G2, G3, H1, H2, H3, I1–I7.
Decisions:
- [2026-09-16] Chat 1 may emit docs-only mega files directly (no runtime behavior → no Chat 2 round-trip). → chore-c.
- [2026-09-16] §25.6 example block uses 3 backticks; should be 4 per the new "bump above any inner run" rule. [resolved 2026-09-17 in chore-f]
- [2026-09-16] OFF-7 routed to batch 1.4. → Deferred.
- [2026-09-16] SESSION_STATE.md is the phase's single document. → chore-d.
- [2026-09-16] Permanent-failure UX for OFF-8/9: revert local RxDB patch via `FriendsProvider`. → 1.1.fix.
- [2026-09-16] OFF-10 offline UX: enqueue + throw `OfflineError`; `useMyProfile` optimistic; `SetUsernameSheet` distinguishes offline from save-failed. → 1.1.fix.
- [2026-09-16] OFF-3 image-queue deferral: only error-message fix ships; full queue deferred. → Deferred.
- [2026-09-17] Chat 2 must append post-batch instructions (§25.8). → chore-e.
- [2026-09-17] §25.9 reasoning discipline added. → chore-e.
- [2026-09-17] `npm run apply*` copies output to clipboard on exit. → chore-e.
- [2026-09-17] OQ1–OQ6 from chore-f (compression disposition, verbatim preservation list, §5.1 fence rules, §25.5/§25.9/§25.10 additions, §26, Changelog index format). → chore-f.
- [2026-09-17] §0 dedup follow-up (merged former rules 2 + 10). → chore-f.
- [2026-09-17] CHORE-G rationale: (1) restore D1/D3/D7/F9 rationale in §18 rather than accept a circular pointer; (2) restore §2 behavioral specs for planned views rather than deferring to a separate PRODUCT_NOTES.md file — the spec is small and belongs with the product-reference section; (3) drop F-IDs from §16 rather than preserve cross-references through the phase-close trim; (4) add §25.3 migration note rather than expanding the Changelog; (5) add §25.11 Phase-Close Protocol rather than rely on Chat 1 remembering to check for dangling refs. → chore-g.
- [2026-09-17] OFF-11 UX: single non-blocking banner above the calendar (`offline` vs `couldn't refresh` copy); blocking error UI stays for the empty-cache case. Applied identically in `PersonPane` and `FriendCalendarPage`. → 1.1.fix.b.
- [2026-09-17] OFF-13 UX: pre-check `navigator.onLine === false` at the top of `toggleReaction` and return `'timeout'` (skips the optimistic patch entirely). Reuses §21's existing toast; no new UI. → 1.1.fix.b.
- [2026-09-17] OFF-12 UX: extend the existing success toast string with the missing-image count; no new state, no new sheet. → 1.1.fix.b.
- [2026-09-17] OFF-2 fix: switch `resolveAuthenticatedUserId` to the raw `account` client from `./appwrite`. Sync is not the session owner; `guardedAccount` is reserved for callers where a 401 *is* an expiry signal. → 1.1.fix.b.
- [2026-09-17] OFF-4 fix: `console.warn` per dropped entry inside the cap branch of `enqueueMessageAction`. No persisted drop counter, no user-facing surface (out of scope; §18 documents the cap). → 1.1.fix.b.
- [2026-09-17] Batch 1.2 scope: Option A (full realtime layer over all six tables). Rationale: §1 promises 0ms load and §20.5 documented a 90–120s read-receipt worst case; a messages-only layer would leave friendship/task-reaction paths on the poll, and the extra cost of subscribing to six table channels is one channel string per collection. → 1.2.
- [2026-09-17] Realtime application policy: `src/db/realtime.ts` mirrors the sync pull loop's rules (read_at applied regardless of dirty state on outgoing messages; all other fields local-newer-wins; CONFLICT preserved not logged; `isDeleted` tombstones via `incrementalPatch`). Realtime is additive, not a replacement — the poll drops to 5 min as a safety net, and focus/online sync is untouched. → 1.2.
- [2026-09-17] Realtime lifecycle: owned by `AppLayout` (open on `user.$id`, close on sign-out/unmount). `startRealtime` is idempotent per user and tears down previous subscriptions on user switch. `guardedRealtime.subscribe` returns a plain `() => void` so callers never touch the raw `Client` (preserves ESLint `no-restricted-imports` boundary). → 1.2.
Deferred:
- OFF-7 → batch 1.4 (imageCache consolidation).
- OFF-1 → blocked on H1 decision.
- OFF-3 local-image-queue half → separate batch (IndexedDB blob queue).
- Realtime channel-level reconnection backoff → future batch (Appwrite SDK handles socket reconnect; if it proves unreliable on mobile, add explicit reconnect logic + a `SyncStatus`-style surface).
LastApply: 2026-09-17 — fix: cached-data rendering + small offline fixes (OFF-11, OFF-13, OFF-12, OFF-2, OFF-4)
LastAuditSummary: Batch 1.2 shipped — full realtime layer (`guardedRealtime` in `sdk.ts`, `src/db/realtime.ts` for all six tables, lifecycle in `AppLayout`, `ChatPage` poll reduced to 5 min). §20.5's 90–120s read-receipt gap is closed by socket delivery; polling remains a safety net.
