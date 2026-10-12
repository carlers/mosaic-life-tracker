# Session checkpoint

Updated: 2026-10-12
Current task: Issue #656 — fix blank first-open React.lazy boundaries, authorized only to stable Scratch Preview (not dev/main).

## Repository and scope
- Baseline `dev@f918b7353d05fb1d4abfdd5452f60a0e0d1db2a1` / 0.19.4. Accepted issue #640 Home/Day View behavior remains untouched.
- Stable Preview `perf/first-open-sheets-656-20261012` with version 0.19.5. Last stable source SHA `1c4ab0fac40a2ea0f551a991694154f450059c94` (PR #677).
- Current task branch `chatgpt/656-compact-suspense` based on that SHA.
- First batch addresses Chat sticker picker and Notifications friend-day sheet: preload module code after the owning view is usable, cache resolved React component so a warmed first open commits without initial lazy suspension; preserve true cold load, retry after rejected imports, stable component identity, composer's pointer/focus, user-scoped data isolation.
- Explicitly deferred #656 work: Home friend-carousel preferences, friend Calendar day, nested task Share/Link sheets, and audit of intentional visible-loading surfaces. Do not report as fixed; preserve their pre-existing behavior.
- No Appwrite mutation, production config, new dependency, design change, or size-cap increases.

## Verification and outstanding
- Last pre-repair `1c4ab0...` Vercel exact Scratch/GIPHY build `dpl_AcwsDN1ZqdV56BYrKTfzxoPBjSy9`: six of seven size limits passed; aggregate gzip **+6 bytes**. Previous `085c8b...` GitHub build/checks/DOM passed but browser shard 2/2 had a recurring unrelated empty-category gesture target mismatch (`interaction-contract.spec.mjs:899`). Canonical SUCCESS on exact final SHA remains mandatory.
- Repair replaces `<Suspense fallback={null}>` with equivalent implicit empty fallback and uses global `setTimeout/clearTimeout` in Chat and Notifications delayed module warmups instead of identical `window.` references. Preserve cold blank fallback under pending import; current DOM tests cover it.
- The additional DOM tests protect synchronous warm first commit, cold fallback, failure/retry on a later mount and composer pointer focus.
- Device tap-to-paint, iOS/Android and offline/PWA human acceptance are **not** completed; do not misreport browser CI as device testing.

## Next action
1. Verify task focused CI, squash `chatgpt/656-compact-suspense` into stable Preview, rerun full exact-SHA canonical GitHub CI.
2. Require exact final SHA GIPHY-enabled Scratch Vercel READY, all seven unchanged size budgets passing and matching stable alias. Investigate/rerun isolated unrelated browser-test instability if needed.
3. Post issue #656 acceptance checkpoint with PRs, final SHA, run, Vercel link and deferred scope. Keep issue open for user acceptance and next audited batches.
4. Ask user to test Chat sticker and Notifications friend-day immediate-after-refresh, after idle and repeat opens, Back/Escape/focus/offline, plus #640 Day View non-regression. Do not merge to dev/main without explicit authorization.
