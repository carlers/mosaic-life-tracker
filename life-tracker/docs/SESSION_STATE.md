# Session checkpoint

Updated: 2026-10-12
Current task: Issue #656 — first-open lazy sheets, authorized implementation through Scratch Preview only.

## Scope and exact base
- Original task: `chatgpt/first-open-sheets-656-20261012` from `dev@f918b7353d05fb1d4abfdd5452f60a0e0d1db2a1`.
- Stable Preview branch: `perf/first-open-sheets-656-20261012`. Squashed initial candidate at `45532098a9f5e30b9d9167377a8d159b667ff862`; repair task `chatgpt/first-open-656-size-repair-20261012`. Planned user-testable PATCH v0.19.5 (dev is 0.19.4).
- No dev/main promotion or Appwrite/Production changes authorized. #640 v0.19.4 Day View is accepted in dev; preserve it.

## Implementation candidate
- `src/lib/createPreloadedLazy.tsx`: module-only warmup with cached resolved component, stable type per mount, cold Suspense path, retry of rejected preload on a later mount.
- Home friend-carousel preferences, Chat sticker picker, Notifications alert friend-day sheet, friend Calendar day sheet: targeted preloading after owning view is usable with intent handlers where available. Do not block Day View startup or mount sheets early.
- Day View Share Task and Link Task to Bucket List: preload module after task actions open; preserve parent/nested sheet Back/history ownership and existing mounted-share lifecycle.
- Keep existing visible loading states for GIPHY, emoji picker, images and route previews. Friend reply composer already mounts closed; no extra preload.
- Added preloaded first-commit/cold/retry React and composer-focus regressions. Share one cancellable code-only idle scheduler among the six target sheet entry points.
- Version candidate v0.19.5; all build-size budgets remain unchanged.

## Verification and budget repair
- Original task browser shards successful: CI 38193200262. After required checkpoint heading repair, focused CI 38193356044 SUCCESS. Source PR #661 squash merged to stable Preview.
- Initial Vercel GIPHY-enabled stable Preview build `dpl_9WoJScQesnqsAz8Wkd34YS11tFvr` FAILED only build-size: Home gzip +175 B, aggregate raw +1,128 B, aggregate gzip +458 B, precache +1,247 B; entry, initial and entry-gzip caps passed. No budget increases permitted.
- Repair consolidates five duplicated idle warmup effects into a single cancellable helper, retains delayed Home priority, and tests canceled timers.


## Budget-scoped final candidate
- Repair task `chatgpt/perf-656-scope-trim` from stable Preview `9fe6d626e15cdab822c5f0a272e98dc8c77015b2`. Second GIPHY-enabled Preview build `dpl_8CgQoKCG4rjyzazA1zZDpnwqNV9f` still failed Home gzip (+307 B), aggregate raw (+351 B), gzip (+422 B), precache (+470 B).
- To protect the strict unchanged budgets, keep the first proven high-value paths: Home friend preferences, Chat stickers, Notifications alert friend-day. Restore friend Calendar and nested Share/Link to unchanged dev behavior, explicitly defer those as #656 batch B pending measurement/size headroom. Existing spinner/photo/GIPHY/route previews stay untouched.
- Keep resolved-component first-commit regression and composer intent/focus tests; split the reusable idle timer from the shared component factory so it is not pulled into Home's static closure.
- Repair branch needs focused CI, stable squash PR, exact-SHA canonical+GIPHY Vercel READY. No dev/main promotion.

## Next action
1. Validate scope-trim repair focused CI; squash into stable Preview and require all seven unchanged budgets on both canonical CI and GIPHY-enabled Vercel.
2. After task checks green, squash into stable Preview branch; run canonical full CI and verify exact-source Vercel Scratch/GIPHY deployment, unchanged seven budgets and version.
3. User-device first/repeat open tests: Home friend preferences, Chat stickers, Notifications friend-day, friend calendar, Day View Share/Link; cold tap immediately and after idle, Back/Escape, nested focus, offline/PWA and no #640 regression.
4. Post issue #656 checkpoint with exact commit/PR/checks/Preview and remaining human acceptance. Do not merge to dev/main without explicit approval.

## Limits
No local repository checkout or device/browser instrumentation available through this chat connection; measured mobile tap-to-paint is not yet verified. Automated tests and hosted CI must be reported separately from device acceptance.
