# Session checkpoint

Updated: 2026-10-12
Current task: #656 — audit/fix deferred first-open sheets, v0.20.5 task and stable Preview only. No dev/main promotion.

## #656 remaining lazy sheet follow-up
- Base: dev@a34fa945 (v0.20.4); task chatgpt/656-deferred-sheets-20261012; stable perf/deferred-first-open-656-20261012.
- Scope: Home friend preferences + nested Day View Share/Link, using settled-component cache with post-usable code-only warmup and first-commit DOM regressions. Preserve all previously accepted #640/#656 fixes; no hidden sheet mounts or backend changes.
- Reply composer currently mounts its lazy boundary while closed, so it is not a confirmed warm-first-action gap. Existing visible fallbacks (GIPHY, emoji, route preview and image viewer) remain intentionally untouched; collect timing data before other changes.
- Proposed version 0.20.5, three startup-sensitive size limits unchanged.
Next action: focused [verify:focused] → stable Preview squash → canonical + exact GIPHY Scratch Vercel seven-budget verification → device acceptance; no dev/main merge.

## #656 first-open Menu/friend-day Preview repair
- Additional real-path root cause in FriendDayViewSheet: the lazy photo viewer was always rendered (isOpen=false) and suspended to a full-screen spinner on first friend sheet mount, even when no photo was tapped. Guard its lazy instantiation by isImageViewerOpen; retain the original requested-photo fallback and ensure image view still opens. Add regression asserting no image-viewer module load/overlay on ordinary first-open, plus async photo open coverage. Follow up with task focused and exact-source full Preview gate at same v0.20.4. No changed acceptance scope.
- First stable Preview `perf/friend-menu-cold-open-656-20261012@5ca4f6da` on dev bb527a passed DOM and browser CI shards but full checks caught Fast Refresh lint on a .tsx non-JSX mixed export and exact GIPHY Vercel budget exceeded four tiny aggregate caps; startup entry/initial metrics all pass.
- Repair helper module filename to plain .ts (no JSX) and generator index. Four narrowly reviewed guard ceilings recorded in #656 issue comment 6117480055 after exact hosted metrics; preserve historic baseline and entry/initial ceilings. Retain v0.20.4, no version bump for internal fix.
- Next: task focused CI → repair PR squash to stable Preview → exact-source full canonical CI / Scratch GIPHY Vercel READY / all seven budgets. Await first-open mobile/desktop manual acceptance. Do not merge dev/main or change Appwrite/Production.

## Prior integration
- #655 is already integrated on dev v0.20.3; its detailed historical handoff remains on issue #655 and merged PR history. This task preserves its PWA and Settings behavior.

## Relevant preceding checkpoints (details live on their issues)
- **Category TaskBlock color (v0.20.2, on dev):** Synced Preferences option for Default, unchanged category-text hue, or category border on incomplete Calendar TaskBlocks, including viewed friends. Completed tasks and Day View rows remain unchanged. The prior standalone Preview was `feature/taskblock-incomplete-color-20261012`; preserve all its accepted behavior/tests.
- **Issue #645:** D1 source-intent map and generated D2 component index on an independent Preview; D3 measurement is a separate workstream. Do not merge that Preview implicitly.
- **Issue #640:** User-accepted first-open Day View speed fix already integrated into dev; prior GIPHY-only aggregate size review recorded in #640. Preserve its performance behavior and baseline.

