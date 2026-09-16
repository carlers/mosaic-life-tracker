# SESSION STATE

Updated: 2026-09-17T00:00:00Z
ActivePlan: Phase 1 audits â€” final sweep
CurrentBatch: 1 of 6
CurrentTask: 1.1.chore-f â€” AGENTS.md compression (audit-approved rewrite)
Status: in_progress
NextAction: Run `npm run apply`, then resume 1.1.fix.b per BatchPlan.
NextChatRole: chat2
BatchPlan:
- Phase 1 audits â€” final sweep (current)
  - [x] 1.1 Item 10 â€” offline behavior audit (findings inline below)
  - [x] 1.1.chore â€” dump XML format
  - [x] 1.1.chore-b â€” Â§25.4/Â§25.6 offboarding-trigger split + review payload
  - [x] 1.1.chore-c â€” Chat 1 docs carve-out + review-artifact boundary
  - [x] 1.1.chore-d â€” SESSION_STATE.md as phase document + audit findings baked in
  - [x] 1.1.fix â€” Offline write resilience (OFF-8, OFF-9, OFF-10, OFF-3 error-message only)
  - [x] 1.1.chore-e â€” Â§25.8 post-batch instructions + Â§25.9 reasoning discipline + apply clipboard
  - [x] 1.1.chore-f â€” AGENTS.md compression
  - [ ] 1.1.fix.b â€” Cached-data rendering + small offline fixes (OFF-11, OFF-13, OFF-12, OFF-2, OFF-4)
  - [ ] 1.2 Item 9 â€” realtime subscriptions layer
  - [ ] 1.3 Item 12 â€” error boundaries / crash resilience
  - [ ] 1.4 Item 7 residual â€” storage/imageCache consolidation (receives OFF-7)
  - [ ] 1.5 Item 11 â€” PWA / service worker
  - [ ] 1.6 Item 13 â€” accessibility
- [ ] Phase 2 â€” refactor audit â†’ refactor
- [ ] Phase 3 â€” optimize audit â†’ optimize (bundle 1.7 MB, route splitting, lazy images)
- [ ] Phase 4 â€” spec audit group (meta-audit of AGENTS.md, discovery, enforcement)
- [ ] Feature work â€” Phase 3.5 Todo List, 3.6 Diary, 3.7 Notifications, API integrations (paused)
OpenQuestions:
- H1 â€” offline auth gate (OFF-1). Â§1 claims "100% offline functionality"; Â§23.6 maps network error â†’ `user: null` â†’ retry screen. Product/architecture decision required before Chat 2 can fix OFF-1. Options: (a) hydrate user from cached identity on network failure; (b) rename retry screen to an offline-mode screen with local read-only access; (c) accept behavior and downgrade Â§1's claim in docs.
Findings:
- CHORE-F-1 â€” Â§0 Hard Rules added (10 rules, ≤200 tokens); cross-refs only, no behavioral change.
- CHORE-F-2 â€” Â§2, Â§4, Â§5.1, Â§7, Â§9–Â§17, Â§19, Â§21–Â§22, Â§24 compressed per disposition table; intent preserved.
- CHORE-F-3 â€” Â§8 rewritten to 5-bullet current state + Changelog pointer.
- CHORE-F-4 â€” Â§15 directory roles compressed; trios + SDK rule preserved verbatim.
- CHORE-F-5 â€” Â§16 rules converted to numbered one-liners with finding IDs; RENDER_WINDOW/EMPTY_TASKS preserved.
- CHORE-F-6 â€” Â§18 Accepted Limitations â†’ one-line disposition + Changelog pointer; named constants preserved.
- CHORE-F-7 â€” Â§25.5 examples, Â§25.9 response-shape rules, Â§25.10 DeepThink defaults, Â§26 (rules for writing rules) added.
- CHORE-F-8 â€” Changelog rewritten as index rows (~80% length reduction).
- OFF-1 Critical â€” Offline cold launch blocks access to local data. `AuthProvider.resolveInitialUser` sets `user: null, isOffline: true` on network error; `AppLayout` renders the retry screen when `!user && isOffline`; no branch renders the protected tree with a cached identity. All data is in IndexedDB and fully readable â€” the block is purely the live `account.get()` probe. Violates Â§1 ("100% offline functionality"). Fix direction: persist last-known user identity (localStorage or settings row); on mount-time network error, hydrate `user` from cache and set `isOffline: true`; render app tree with offline banner; clear cached identity on explicit logout or confirmed 401 (not on network error). DECISION PENDING (H1).
- OFF-2 Medium â€” Spurious `auth:unauthorized` fires on cold-load-without-session. `main.tsx` fires `initializeSync()` before `createRoot().render()`. On no-session cold load, sync's `guardedAccount.get()` 401s â†’ `guardedCall` dispatches `auth:unauthorized` â†’ `AuthProvider`'s listener sets `"Your session has expired. Please sign in again."` in parallel with `resolveInitialUser` (raw `account.get()`) which sets `error: null`. Intermittent "session expired" message on a fresh device. Fix direction: `resolveAuthenticatedUserId` uses raw `account` from `appwrite.ts` (not the guard); sync doesn't own session state.
- OFF-3 High â€” Image upload offline discards the compressed blob. `storage.uploadImage`: `getCurrentUserId()` catches all errors â†’ returns null â†’ throws `"Cannot upload image: no authenticated user"`. Message is misleading (user IS authenticated, just offline). No local queue for the compressed blob. Fix direction: (a) `getCurrentUserId` distinguishes "no session" from "couldn't check" â€” throw `'Offline'` when `navigator.onLine === false`; (b) larger fix: local image queue â€” store blob in `imageCache`, set `task.image = 'img_pending_<uuid>'`, upload on `online`. [resolved 1.1.fix â€” error-message fix only: `getCurrentUserId` returns null on 401, throws `OfflineError` on network; local image queue deferred to a separate batch]
- OFF-4 Low â€” `messageActionQueue` cap drop is silent. At >100 entries, drops oldest by `enqueuedAt` sort; no log, no user-visible indicator. `mark_read` reconciles on next `ChatPage` open; a dropped `unsend` is permanent on the recipient side. Fix direction: `console.warn` on drop; document cap in Â§18 accepted limitations.
- OFF-6 Low â€” `imageCache` has no eviction bound. `cacheImage` writes raw blobs to IndexedDB with no size cap, no LRU, no TTL; blobs persist until explicit `deleteImage(fileId)`. Cumulative over time under storage pressure. Fix direction: document in Â§18; optional LRU cap in future refactor.
- OFF-7 Info (DEFERRED to batch 1.4) â€” `src/lib/imageCache.ts` duplicates `src/lib/storage.ts`'s private cache implementation. Same IndexedDB database `mosaic_image_cache`, same store `blobs`, identical four operations. `exportData.ts` imports from `imageCache.ts`; `storage.ts` uses its private copy. No behavioral bug â€” drift risk only. Fix belongs in batch 1.4 (Item 7 residual).
- OFF-8 High â€” `sendFriendRequest` offline silently loses the reciprocal row. `social.sendFriendRequest`: local `db.friendships.upsert(myLocalRow)` succeeds offline; remote `guardedTablesDB.upsertRow({...friendRowId})` throws offline; `FriendsProvider.sendRequest` propagates without catch; `ExploreView.handleAdd` only `console.error`s. User sees `sendingTo` reset; local row says `pending_outgoing`; the friend's reciprocal row (`fr_<hash(friendId, myUserId)>`) was never created. The sync engine will never fix this â€” it only pushes rows where `user_id === myUserId`. Fix direction: persistent outbox for the reciprocal write; retry on `online`/`focus`/`AppLayout` mount; permanent failures (401, non-429 4xx) surface a toast and revert the local row. [resolved 1.1.fix â€” `socialOutbox.ts` enqueues the reciprocal upsert on transient failure; permanent failures revert the local row via `FriendsProvider` and surface the "Couldn't send request" toast]
- OFF-9 High â€” `acceptFriendRequest` / `deleteFriendPair` / `blockFriend` offline lose the reciprocal update. Same pattern as OFF-8. Local row patched; remote `guardedTablesDB.updateRow` on the friend's row throws offline; `FriendsProvider.accept/decline/cancel/remove/block` don't catch. `deleteFriendPair` and `blockFriend` additionally swallow the remote error with a bare `console.warn` even online. My state diverges from the friend's; worst case is a soft-deleted local row that the friend still sees as accepted. Fix direction: same outbox as OFF-8; replace bare `console.warn` in `deleteFriendPair`/`blockFriend` with the retry path. [resolved 1.1.fix â€” same outbox path; bare `console.warn` replaced; revert restores the prior status (`previousStatus` captured before the local patch)]
- OFF-10 Medium â€” Profile create/update requires network with no local queue. `social.createOrUpdateProfile` calls `guardedTablesDB.upsertRow` directly; no `profiles` RxDB collection. Offline â†’ throws â†’ `SetUsernameSheet` shows `"Could not save. Try again."`. User cannot set up a profile offline. Not data loss (no local row to diverge), but the offline-first contract degrades. Fix direction: same outbox as OFF-8/9. [resolved 1.1.fix â€” outbox enqueues the profile upsert; `createOrUpdateProfile` throws `OfflineError`; `useMyProfile` optimistically sets the local profile; `SetUsernameSheet` distinguishes "offline" from "save failed"]
- OFF-11 High â€” Cached friend data hidden by a transient refetch error. `PersonPane`'s activation refetch calls `refetchFriendCalendar(true)` with `forceRefresh: true`, bypassing the cache check and hitting `navigator.onLine === false` â†’ `FriendAccessError('offline')`. `useFriendCalendar.load` sets error state but preserves `tasks`/`categories`. Both `PersonPane` and `FriendCalendarPage` gate render on `error ? <error UI> : <data UI>` â€” the error wins even when cached tasks exist. Offline swipe to a friend pane with fully cached data replaces the calendar with "You're offline." Fix direction: gate error UI on `tasks.length === 0 && error`; when cached data exists, render the calendar and show a non-blocking offline indicator.
- OFF-12 Low â€” Export offline: missing images not surfaced. `payload.counts.missingImages` is populated and the manifest includes `payload.images.missingImages`, but the user-facing toast says only `"Export ready"`. Silent incompleteness â€” user stores an export believing it's a full backup. Fix direction: after `exportUserData` returns, if `result.counts.missingImages > 0`, extend the toast to `"Export ready (N photos couldn't be fetched â€” re-export online to include them)"`.
- OFF-13 Low â€” Reaction toggle offline silently reverts. `toggleReaction` in `useMessages`: `reactOnRemote` throws on offline; the `.catch` reverts locally and logs but the function returns `'ok'` synchronously. For an already-delivered message, no timeout branch fires; `ChatPage` sees `'ok'` and shows no toast. Reaction flashes and disappears with no explanation. (For pending outgoing messages, the earlier delivery-wait branch does return `'timeout'` â€” pending is covered, delivered is not.) Fix direction: `navigator.onLine === false` pre-check at the top of `toggleReaction` returns `'timeout'` immediately; reuse Â§21's `"Couldn't send reaction. Try again."` toast.
- Non-findings (verified correct): OFF-5 (`handleDeliver` idempotent â€” both rows check-then-skip on retry, retry-safe); E2, E3, F4, F5, F6, G1, G2, G3, H1, H2, H3, I1â€“I7.
Decisions:
- [2026-09-16] Chat 1 may emit docs-only mega files directly (no runtime behavior â†’ no Chat 2 round-trip). Runtime-affecting changes still route through Chat 2. â†’ chore-c.
- [2026-09-16] Â§25.6 example block uses 3 backticks; should be 4 per the new "bump above any inner run" rule. Low priority â€” no breakage; the example is illustrative. Deferred to next AGENTS.md open.
- [2026-09-16] OFF-7 (imageCache/storage duplication) routed to batch 1.4 rather than fixed in 1.1.fix.b. Rationale: no behavioral bug; Item 7 residual already scoped for exactly this. â†’ Deferred.
- [2026-09-16] SESSION_STATE.md is the phase's single document â€” findings, decisions, and deferrals live in it rather than in separate per-audit files. Rationale: a separate `AUDIT_ITEM_10.md` was referenced but never actually created, producing a dangling pointer. One authoritative file eliminates the failure class. â†’ chore-d.
- [2026-09-16] Permanent-failure UX for OFF-8/9: revert the local RxDB patch via `FriendsProvider` (which owns the local social mutators) rather than blocking the UI or retrying forever. The outbox emits a `SocialOutboxFailureEvent`; `FriendsProvider` un-patches (soft-delete for `send_request`, status restore for `accept`/`block`, un-delete for `delete_friend_pair`); `ExploreView` surfaces the existing toast pattern. Rationale: matches the existing `toggleReaction` optimistic-then-revert idiom (Â§9) and reuses the existing toast primitive (Â§10) without adding new UX surfaces. â†’ 1.1.fix.
- [2026-09-16] OFF-10 offline UX: `createOrUpdateProfile` enqueues the upsert AND throws `OfflineError`; `useMyProfile` optimistically sets the local profile so a retry does not trip the "username taken" branch; `SetUsernameSheet` extends its existing catch to show "You're offline. Your profile will sync when you reconnect." Rationale: no local RxDB collection for profiles, so the "revert" half of the OFF-8/9 pattern does not apply; the sheet's existing error path is the correct surfacing surface. â†’ 1.1.fix.
- [2026-09-16] OFF-3 image-queue deferral: only the error-message fix (`getCurrentUserId` distinguishes 401 from network) ships in 1.1.fix. The full local-image-queue fix is deferred â€” it requires a new IndexedDB blob queue and a `img_pending_*` sentinel, which is a different mechanism from the JSON-outbox retry used for social writes. Separate batch. â†’ Deferred (no target batch yet; will be scoped after OFF-1/H1 resolves).
- [2026-09-17] Chat 2 must append post-batch instructions after every mega file (Â§25.8). Rationale: mega-file-only output left Chat 0 without a next-step signal. â†’ chore-e.
- [2026-09-17] Â§25.9 reasoning discipline added after observing ~40% CoT waste in 1.1.fix (decision loops on OFF-10, spec re-reads, inline option enumeration). â†’ chore-e.
- [2026-09-17] `npm run apply*` copies full output to clipboard on exit, all modes, success or failure. Rationale: the paste-back loop had no reliable transport. â†’ chore-e.
- [2026-09-17] OQ1 â€” Â§0 Hard Rules added at top; ≤10 one-liners, ≤200 tokens; cross-ref owning sections. â†’ chore-f.
- [2026-09-17] OQ2 â€” Section compression per disposition table; verbatim preservation for Â§1/Â§3/Â§5/Â§6/Â§12/Â§18/Â§20/Â§23/Â§25 and named constants (PULL_OVERLAP_MS, FRIEND_REFETCH_MIN_INTERVAL_MS, REACTIONS_MAX_LEN, RENDER_WINDOW, EMPTY_TASKS, toast string). â†’ chore-f.
- [2026-09-17] OQ3 â€” Â§5.1 compressed to numbered fence rules; pitfalls prose deleted; outer-fence regex preserved verbatim. â†’ chore-f.
- [2026-09-17] OQ4 â€” Â§25.5 examples + Â§25.9 response-shape rules + Â§25.10 DeepThink defaults added. â†’ chore-f.
- [2026-09-17] OQ5 â€” Â§26 "Writing AGENTS.md" added; rules verified against observed fix cycles. â†’ chore-f.
- [2026-09-17] OQ6 â€” Changelog rewritten as index rows (`date â€” title â€” sections â€” one-phrase summary; see pointer`); ~80% row-length reduction on last 10 rows. â†’ chore-f.
Deferred:
- OFF-7 â†’ batch 1.4 (imageCache consolidation).
- OFF-1 â†’ blocked on H1 decision.
- OFF-3 local-image-queue half â†’ separate batch (IndexedDB blob queue; different mechanism from the social outbox).
LastApply: 2026-09-17 â€” chore: post-batch instructions + reasoning discipline + apply clipboard
LastAuditSummary: AGENTS.md compression audit closed â€” Tier 1 size reduction applied.
