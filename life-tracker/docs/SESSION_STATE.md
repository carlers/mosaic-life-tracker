# Session checkpoint

Updated: 2026-10-12
Current task: issue #655 — measurable PWA update asset preparation progress, task branch and stable Preview only (no dev/main promotion).

## #655 Preview update test — v0.20.1

- **Base:** accepted `feature/pwa-progress-655` at `ff9f42193f64e01ed884124bbc5263804b7fe6ee` (v0.20.0); canonical GitHub CI success and exact-SHA Vercel Scratch Preview READY. Leave dev/main untouched.
- **Approved change:** Me `/account` Categories tile opens the same lazily mounted `CategoryManagerSheet` as Home > Lists & Categories, preserving the existing sheet and tile styling.
- **Test revision:** v0.20.1 (PATCH, first real user-testable update of #655); package, lockfile, and APP_VERSION agree. Regression verifies accessible Categories tile opens/closes the manager.
- **Preview flow:** task branch `chatgpt/pwa-655-category-update-test` → focused CI → squash PR into `feature/pwa-progress-655` → canonical CI plus exact-SHA GIPHY-enabled Vercel READY. No Appwrite changes.
- **Manual acceptance pending:** with the *old v0.20.0* app already open/installed at the stable Preview alias, deploy v0.20.1, use Settings > Check for updates, inspect per-file asset sizes/percent and explicit Update now, verify Me > Categories opens the existing manager. First install, browser-managed install and activation do not expose true downloaded bytes; do not claim otherwise.

## Previous workstream checkpoints

Updated: 2026-10-12
Current task: Issue #645 Phase 2 D1/D2 repository source discovery pilot; user authorized task branch and stable Preview, not dev/main merge.

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
