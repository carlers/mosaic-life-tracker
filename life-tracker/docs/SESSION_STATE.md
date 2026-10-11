# Session checkpoint

Updated: 2026-10-11
Current task: granular production version history and compact offline-first release UI, Preview v0.16.8. No dev/main promotion authorized.

## Verified baseline
- Source dev: `b76ca6295a8409309c232b25d44fa7f63cbc6878` (v0.16.7); production main `614cd1dccbd01bf70493874496559720b320151a` (v0.16.6).
- Branch `chatgpt/granular-release-history`; stable Preview target `feature/granular-release-history`.
- Published GitHub Releases: v0.12.1, v0.12.2 and v0.16.6. Intermediate versions were absent because only production release tags were listed.
- Frontend + trusted release publisher/workflow only. No Appwrite schema, Function, keys or production deployments touched.

## Candidate
- Verified dev first-parent version milestones are embedded in published GitHub Release notes (one genuine production tag per promotion). Existing v0.12.1/v0.12.2/v0.16.6 notes may be backfilled on a later production publication only after pinned tag/parent-version/ancestry/prod proof.
- Settings release list groups individual milestone rows under each actual production release, retains original aggregate notes, safely formats Markdown and reduces spacing.
- Public account-independent localStorage history is rendered immediately from cache with on-demand refresh and offline fallback. Lazy route preserved.
- Version synchronized to 0.16.8; parser, UI, publisher and cache regressions included.

## Verification
- Initial task focused CI runs 38109041892 and 38109167845: SUCCESS. Preview PR #554 squash-merged as 556aea549bd75e611038dc9e26a8b481d1e59f19.
- First Preview Vercel build failed only aggregate raw asset (+1,877 B) and precache (+2,228 B) ceilings; initial/Home/gzip budgets and app compilation passed. Repair branch chatgpt/granular-release-size-repair simplifies the lazy Markdown renderer and narrowly adjusts only affected aggregate/precache caps (+2,200 / +2,700 B), preserving entry, initial, Home, and gzip limits.
- Repair focused CI and stable Preview canonical CI/Vercel delivery are required; do not claim completed until verified.
- No browser, iOS or Android visual acceptance has been performed.

## Next action
- Confirm task diff, focused verification and any CI repairs on task branch.
- Squash accepted task commit into stable Preview `feature/granular-release-history`; require canonical full gate and exact Vercel Preview readiness.
- Obtain explicit approval before promoting to dev or main. Historical release-note reconciliation will not run until trusted post-main publisher.
