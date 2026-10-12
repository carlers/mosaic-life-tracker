# Session checkpoint

Updated: 2026-10-12
Current task: Issue #656 — first-open React.lazy sheet delay; authorized implementation through stable Scratch Preview only.

## Exact source and branches
- Source baseline: `dev@f918b7353d05fb1d4abfdd5452f60a0e0d1db2a1`, version 0.19.4. Accepted #640 first-open Day View implementation stays byte-for-byte identical in Home.
- Stable Preview: `perf/first-open-sheets-656-20261012`, latest pre-repair `710337fd2ea843825083c4d49e5cfaa0e3356972`, user-testable candidate v0.19.5.
- Current repair task: `chatgpt/656-reduce-cold-lazy` from that stable SHA. Never merge to dev/main without separate explicit approval. Do not touch Scratch Appwrite shared functions or Production.

## First measurable batch delivered in code
- `src/lib/createPreloadedLazy.tsx`: cache resolved component for synchronous first React commit after code warmup; preserve cold fallback, stable mount type, retry after rejected imports. Latest repair eliminates the module-wide cold React.lazy instance: create a cold lazy type only on mounting an unready sheet, so failure recovery needs no factory/reset logic.
- `src/pages/ChatPage.tsx` and `src/components/messages/MessageComposer.tsx`: delayed module-only warmup after usable Chat plus pointerdown sticker intent (preserves composer focus). Do not mount hidden sticker data hooks.
- `src/pages/NotificationsPage.tsx`: delayed code-only friend-day warmup after user-scoped feed becomes usable. Friend-day remote data loads only when sheet actually mounts.
- Regression tests cover preloaded first synchronous commit, cold path, no remount after pending import, rejected import recovery, and composer focus/pointer interaction. Added direct cold-on-demand retry after failed preload to validate the simpler factory.
- Home friend preferences, friend Calendar day, nested Share/Link task sheets and intentional visible-loading paths remain deferred for a subsequent *measured* #656 batch. Do not claim them fixed. The accepted #640 Day View and Home were restored to dev.

## Verified and outstanding gates
- Previous stable `710337fd...` GitHub full canonical SUCCESS [run 38195455370]; exact GIPHY-enabled Scratch Vercel `dpl_7UnwwNDjviapK9xKFHHeXPmpAjEV` ERROR **only** size budgets: aggregate gzip +30 B and precache +18 B; other five size metrics passed. Existing size ceilings unchanged; Vercel was not READY.
- Current repair simplifies shared lazy loader (fewer shipped bytes, same invariants). Require task focused CI, squash stable Preview PR, and **both** full canonical GitHub SUCCESS **and** GIPHY-enabled Scratch Vercel READY for identical final SHA before user testing.
- No actual iOS/Android device tests or first/idle tap-to-paint measurements completed. Do not claim manual acceptance or dev readiness.

## Final hosted-size repair (small, behavior-equivalent)
- Latest stable pre-repair SHA `085c8b9217e7bfd6da515277baa712cc2d9ba60b` after PR #675. [Focused CI 38199480848](https://github.com/carlers/mosaic-life-tracker/actions/runs/38199480848) SUCCESS. Scratch/GIPHY Vercel `dpl_5ZV3QPzT1VwCn9PUjoKhhBeadsd7` failed **only** aggregate gzip by 14 B; six other unchanged size ceilings passed, including precache.
- Task branch `chatgpt/656-final-byte-reduction` removes redundant resolved-import `Promise.resolve` handling (a successful preload already retains its resolved Promise) and uses equivalent `!document.hidden` visibility guards in Chat/Notifications. Cold/warm/retry tests remain unchanged. No new feature, theme, budgets, routes, API requests or Appwrite mutations.
- Next: focused CI, squash into stable Preview, require exact source SHA full canonical plus GIPHY-enabled Scratch Vercel READY before user-device testing.

## Next action
1. Run focused CI on `chatgpt/656-final-byte-reduction`; fix any failures then squash task PR into stable Preview.
2. Verify final exact-SHA full canonical CI, seven unchanged size budgets, Vercel GIPHY/Scratch build READY and stable Preview alias.
3. Update GitHub issue #656 with complete PR/CI/deployment evidence, testable link and deferred follow-up batch.
4. User device acceptance: cold click immediately after fresh launch, idle then first click and repeats for Chat stickers and Notifications friend day; verify pointer-focus, close/Back/Escape, offline/PWA and #640 Day View non-regression. No dev/main promotion without approval.
