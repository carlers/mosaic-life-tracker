# Session checkpoint

Updated: 2026-09-27

Current task: fix the remaining offline-refresh/Login startup stall and incorrect Online indicator observed on Android/PWA after the first offline-startup pass.

Status: implementation complete on `chatgpt/reachability-startup-fix`, targeting stable Preview `perf/offline-startup`. The first full run 1104 exposed two lint leftovers and stale DOM harness assumptions around background auth/reachability; all were repaired and focused run 1108 passed. Replacement exact-SHA full canonical acceptance is requested by this checkpoint commit.

## Working set
- authoritative reachability: `src/lib/connectivity.ts`, guarded Appwrite calls, AuthProvider
- spinner-free Login/authenticated startup: `App.tsx`, `AuthPage.tsx`, `AppLayout.tsx`, `AppDataShell.tsx`
- shared connectivity consumers: Main/Home/Sync Status plus sync/images/social/profile/chat network gates
- regressions for browser-online/Appwrite-unreachable startup and connectivity state
- `docs/PROJECT_REFERENCE.md`

## Completed
- Replaced `navigator.onLine` as the Online authority with one three-state Appwrite reachability store: Checking / Online / Offline.
- Successful Appwrite calls and real HTTP/Appwrite errors prove Online; network/timeout failures prove Offline. Browser offline is a hard negative, while browser online/network-interface/focus/visibility changes only request a background re-check.
- Cached auth is now the immediate local rendering authority even when the browser claims online. Live `account.get()` reconciles in the background; network failure retains local identity, confirmed 401 still revokes it.
- Login no longer lazy-loads behind the generic route spinner and no longer imports Framer Motion on its critical path.
- Split DB-backed authenticated providers into `AppDataShell`. AppLayout is lightweight/eager, preloads the provider shell while RxDB opens, and shows a static Home-shaped local-data shell instead of a spinning page.
- Home lazy loading uses a content skeleton instead of the Mosaic spinner.
- Cached sessions start DB bootstrap immediately even when launch begins at `/login`; genuinely logged-out Login defers RxDB until idle.
- Main offline banner, Home indicators, Sync Status, sync, images, friend data, profile/search, chat polling, message delivery/reactions, and backup image acquisition are being aligned to the shared reachability source.
- Added direct connectivity regression coverage and replaced the browser offline-startup fixture with the missed real-world case: `navigator.onLine === true` while Appwrite hangs/fails.

## Constraints
- Preserve account isolation, generation/race guards, confirmed-401 semantics, local-first writes, sync mappings, tombstones, explicit PWA update behavior, and existing offline image staging.
- Online means confirmed backend reachability, not browser interface state.
- Cached identity may expose only that same account's already-local data while live verification is pending.
- No promotion from `perf/offline-startup` to `dev` without explicit user instruction.

## Verification
- Baseline stable Preview before this repair: `34e0656cfffdb2bcee27535a02eebc9435cd3a34`, Vercel READY.
- Focused verification for this repair: runs 1103, 1108, and 1111 passed.
- Full run 1104 failed on two lint leftovers plus stale AuthProvider/PostHog and message-reaction test assumptions; repaired without weakening behavior.
- Full run 1109 passed build and both DOM shards; checks failed because the sync unit suite never established an Online reachability fixture, and browser shard 1 showed that component-only consumers needed to initialize connectivity listeners themselves. Both were repaired; browser shard 2 had already passed.
- Final replacement exact-SHA full canonical acceptance: requested by this checkpoint commit.
- Stable Preview Quality Gate + Vercel deployment after squash: pending.
- Required manual check: Samsung/Android installed PWA, Wi-Fi/network loss while open and cold offline relaunch.

Next action: follow this exact SHA through full canonical acceptance, repair any failure, then squash PR #96 into `perf/offline-startup` and verify the stable Preview Quality Gate + Vercel deployment.

Blockers: none.
