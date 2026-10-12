# Session checkpoint

Updated: 2026-10-12
Current task: #656 — fix first-open hamburger Menu and friend Calendar Day View; v0.20.4 Preview only, no dev/main promotion.

## #656 first-open Menu/friend-day Preview repair
- Additional real-path root cause in FriendDayViewSheet: the lazy photo viewer was always rendered (isOpen=false) and suspended to a full-screen spinner on first friend sheet mount, even when no photo was tapped. Guard its lazy instantiation by isImageViewerOpen; retain the original requested-photo fallback and ensure image view still opens. Add regression asserting no image-viewer module load/overlay on ordinary first-open, plus async photo open coverage. Follow up with task focused and exact-source full Preview gate at same v0.20.4. No changed acceptance scope.
- First stable Preview `perf/friend-menu-cold-open-656-20261012@5ca4f6da` on dev bb527a passed DOM and browser CI shards but full checks caught Fast Refresh lint on a .tsx non-JSX mixed export and exact GIPHY Vercel budget exceeded four tiny aggregate caps; startup entry/initial metrics all pass.
- Repair helper module filename to plain .ts (no JSX) and generator index. Four narrowly reviewed guard ceilings recorded in #656 issue comment 6117480055 after exact hosted metrics; preserve historic baseline and entry/initial ceilings. Retain v0.20.4, no version bump for internal fix.
- Next: task focused CI → repair PR squash to stable Preview → exact-source full canonical CI / Scratch GIPHY Vercel READY / all seven budgets. Await first-open mobile/desktop manual acceptance. Do not merge dev/main or change Appwrite/Production.

## #655 dev integration of approved Preview
- Integration base dev@`3b4033767c02917390a16764ab260d949548b9f3` (v0.20.2 category-color preference) and accepted PWA Preview `feature/pwa-progress-655@c132b1841792b2d0315b375d6dc5da5ad2a1325e` (v0.20.1). History diverged; a direct merge would regress version/overwrite unrelated dev fixes.
- New task `chatgpt/pwa-progress-655-dev-combine`, stable integration Preview `feature/pwa-progress-655-dev-integration`. v0.20.3 preserves BOTH feature sets: existing exact category hues and Me > Categories manager, PWA precache progress/push/offline/explicit Update now.
- Frontend/build/docs only. Preserve Scratch Preview vs Production isolation. Verify production/PWA worker policy, tests, all size guards (including hosted GIPHY), preview exact SHA and app version. Original PWA CI `38199613209` SUCCESS and Vercel `dpl_5FYeLtHEDtXhmnEJQnj8sfixgw46` READY. Integration limits initially carry that measured PWA candidate; revise only if exact new combined build requires it.
Next action: combined task build was green; address the compact-checkpoint contract and confirm focused CI, then focused/full CI as required, squash into integration Preview, verify exact-SHA canonical acceptance and Scratch Vercel READY, then merge integration Preview into `dev` via PR using merge commit without version regression. Re-read dev for parallel head movement before promotion. Do not merge to main.

- First stable v0.20.3 Preview `631e2f1672fe6f07b5f46c87d4d29900056c2f29` passed task full production build/PWA policy but exact hosted GIPHY build failed only three asset ceilings (Home +49 B, raw +608 B, precache +431 B). Repair task `chatgpt/pwa-655-integrated-hosted-size` reviews only these measured limits, then focused CI → squash stable Preview → exact canonical CI/hosted READY → dev merge PR.

## Relevant preceding checkpoints (details live on their issues)
- **Category TaskBlock color (v0.20.2, on dev):** Synced Preferences option for Default, unchanged category-text hue, or category border on incomplete Calendar TaskBlocks, including viewed friends. Completed tasks and Day View rows remain unchanged. The prior standalone Preview was `feature/taskblock-incomplete-color-20261012`; preserve all its accepted behavior/tests.
- **Issue #645:** D1 source-intent map and generated D2 component index on an independent Preview; D3 measurement is a separate workstream. Do not merge that Preview implicitly.
- **Issue #640:** User-accepted first-open Day View speed fix already integrated into dev; prior GIPHY-only aggregate size review recorded in #640. Preserve its performance behavior and baseline.

