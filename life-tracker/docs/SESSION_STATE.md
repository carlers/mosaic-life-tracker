# Session checkpoint

Updated: 2026-10-12
Current task: Issue #656 — first-open lazy sheets, authorized implementation through Scratch Preview only.

## Scope and exact base
- Task branch: `chatgpt/first-open-sheets-656-20261012` from `dev@f918b7353d05fb1d4abfdd5452f60a0e0d1db2a1`.
- Planned stable Preview branch: `perf/first-open-sheets-656-20261012`. Planned user-testable PATCH v0.19.5 (dev is 0.19.4).
- No dev/main promotion or Appwrite/Production changes authorized. #640 v0.19.4 Day View is accepted in dev; preserve it.

## Implementation candidate
- `src/lib/createPreloadedLazy.tsx`: module-only warmup with cached resolved component, stable type per mount, cold Suspense path, retry of rejected preload on a later mount.
- Home friend-carousel preferences, Chat sticker picker, Notifications alert friend-day sheet, friend Calendar day sheet: targeted preloading after owning view is usable with intent handlers where available. Do not block Day View startup or mount sheets early.
- Day View Share Task and Link Task to Bucket List: preload module after task actions open; preserve parent/nested sheet Back/history ownership and existing mounted-share lifecycle.
- Keep existing visible loading states for GIPHY, emoji picker, images and route previews. Friend reply composer already mounts closed; no extra preload.
- Add preloaded first-commit/cold/retry React regressions and MessageComposer intent/focus tests.
- Version candidate v0.19.5; all build-size budgets remain unchanged.

## Next action
1. Commit coherent task tree with `[verify:browser]` and inspect focused/browser GitHub Actions. Fix any TS, lint, DOM, browser or size failure; do not bypass the guard.
2. After task checks green, squash into stable Preview branch; run canonical full CI and verify exact-source Vercel Scratch/GIPHY deployment, unchanged seven budgets and version.
3. User-device first/repeat open tests: Home friend preferences, Chat stickers, Notifications friend-day, friend calendar, Day View Share/Link; cold tap immediately and after idle, Back/Escape, nested focus, offline/PWA and no #640 regression.
4. Post issue #656 checkpoint with exact commit/PR/checks/Preview and remaining human acceptance. Do not merge to dev/main without explicit approval.

## Limits
No local repository checkout or device/browser instrumentation available through this chat connection; measured mobile tap-to-paint is not yet verified. Automated tests and hosted CI must be reported separately from device acceptance.
