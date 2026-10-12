# Session checkpoint

Updated: 2026-10-12
Current task: #655 PWA download/progress v0.20.3 combined integration with latest dev. User accepted the feature and authorized cleanup plus dev promotion, not main.

## #655 dev integration of approved Preview
- Integration base dev@`3b4033767c02917390a16764ab260d949548b9f3` (v0.20.2 category-color preference) and accepted PWA Preview `feature/pwa-progress-655@c132b1841792b2d0315b375d6dc5da5ad2a1325e` (v0.20.1). History diverged; a direct merge would regress version/overwrite unrelated dev fixes.
- New task `chatgpt/pwa-progress-655-dev-combine`, stable integration Preview `feature/pwa-progress-655-dev-integration`. v0.20.3 preserves BOTH feature sets: existing exact category hues and Me > Categories manager, PWA precache progress/push/offline/explicit Update now.
- Frontend/build/docs only. Preserve Scratch Preview vs Production isolation. Verify production/PWA worker policy, tests, all size guards (including hosted GIPHY), preview exact SHA and app version. Original PWA CI `38199613209` SUCCESS and Vercel `dpl_5FYeLtHEDtXhmnEJQnj8sfixgw46` READY. Integration limits initially carry that measured PWA candidate; revise only if exact new combined build requires it.
- Next: [verify:full] combined task diagnostic for tight bundle ceilings; focused/full CI as required, squash into integration Preview, verify exact-SHA canonical acceptance and Scratch Vercel READY, then merge integration Preview into `dev` via PR using merge commit without version regression. Re-read dev for parallel head movement before promotion. Do not merge to main.

## Previous task — Unmodified category text hue (already on dev)
## Current task — Unmodified category text hue
- User requests Category text use the exact stored category hue, no blending. Low-contrast combinations are left unchanged.
- Task `chatgpt/taskblock-text-raw-color-20261012` starts from `feature/taskblock-incomplete-color-20261012@b884b95`. Replace blend with `categoryColor` while keeping the important-theme fix; browser regression compares actual computed hue to source in Dark/Light/Black.
- v0.20.2, frontend-only. Next: focused CI → stable Preview full gate/Vercel Scratch READY → user acceptance. No dev/main promotion.

## Previous task — incomplete Calendar TaskBlock color
- Base: dev@f918b7353d05fb1d4abfdd5452f60a0e0d1db2a1. Task: chatgpt/taskblock-incomplete-color-20261012. Stable Preview: feature/taskblock-incomplete-color-20261012.
- New account-synced Preferences choice: Default, Category text, or Category border; only unfinished Calendar TaskBlocks change. Applies while viewing the owner's and friends' calendars. Original blended hue is superseded by the user-approved raw color; completed TaskBlocks and Day View rows remain unchanged.
- Planned feature version: 0.20.0. Frontend-only; no Appwrite schema/Function or Production changes.
- First stable Preview c2eb103 had a successful GitHub compile but the GIPHY-enabled Vercel build-size guard exceeded only raw asset bytes by 28 B; the corrective task reuses the existing semantic foreground token to remove a redundant theme variable without relaxing budgets.
- Next action: validate focused repair CI, squash to stable Preview, confirm full canonical CI and exact-SHA Vercel Scratch READY. Await user/device acceptance before dev/main promotion.

## Previous handoff — #645 repository source discovery pilot
Issue #645 Phase 2 D1/D2 repository source discovery pilot; user authorized task branch and stable Preview, not dev/main merge.

## Scope and exact base
- Base: dev@deb497fa032e7e95842f1e79f3a77b45bf3f369e; source-only documentation/tooling changes, no app version bump.
- Task: chatgpt/repo-discovery-645; stable Preview: refactor/repo-discovery-645.
- Existing Phase 1 version-only focused selector remains accepted separately on refactor/focused-version-stamps-645; do not pull it into this branch implicitly.
- Preserve Scratch/Production separation, Preview canonical gate and explicit promotion approvals. The global checkpoint on dev previously referred to Bucket List #405; its completed dev promotion is live Git truth.

## Work
- D1: docs/REPO_MAP.md is a concise optional user-intent-to-source starting hint; docs/README.md links it.
- D2: docs/COMPONENT_INDEX.md indexes all eligible component/page TS modules plus App and protectedRoutes, grouped by source folder. scripts/lib/repo-component-index.mjs and scripts/generate-repo-index.mjs implement offline --write/--check; existing contracts reject stale inventory. Tests cover current completeness, determinism, additions/moves/deletions and Markdown path escaping.
- No runtime behavior, app styles, Appwrite configuration, dependency additions or CI-gate weakening.

## Next action
- Confirm this task commit focused CI green, review exact PR diff, squash through task PR into stable refactor/repo-discovery-645, then verify full canonical acceptance and exact-SHA Vercel READY. Post evidence to issue #645; leave dev/main untouched. D3 isolated cold-chat discovery measurement remains separate and pending.


## #640 device-accepted Day View first-open fix — dev promotion integration
- On 2026-10-12 the user explicitly accepted version 0.19.4 on device and authorized merging into dev.
- Original stable Preview: perf/day-view-idle-warmup-20261011 @ 50437830c719a2ded06132b86e27dcb609733ed4, full canonical https://github.com/carlers/mosaic-life-tracker/actions/runs/38163183012 SUCCESS, Scratch Vercel exact-SHA READY.
- Because dev advanced independently, integrate that verified Day View tree with current dev rather than merging the stale Preview directly. Preserve dev's #405 reviewed build-size ceilings, latest unrelated functionality and documentation; preserve exact accepted v0.19.4 behavior. Re-verify integrated Preview and exact-SHA dev promotion. #640 issue carries detailed evidence.
- Exact GIPHY-enabled integration build crossed only three aggregate asset/precache size caps (raw +6124 B, gzip +1345 B, precache +6275 B); three caps narrowly reviewed under #640, retaining unchanged entry/initial/Home limits and baseline. Run hosted Scratch parity before promotion.
