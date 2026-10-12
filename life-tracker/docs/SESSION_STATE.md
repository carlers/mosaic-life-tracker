# Session checkpoint

Updated: 2026-10-12
Current task: #692 mobile Calendar zoom — accepted Preview integration into dev.
Latest integration base: dev@e714c3325a238ea9da0efaf8ed6ea97665b619cb (v0.20.7).
Accepted feature: feature/calendar-zoom-692-20261012@b70bda97583d1b421512ac8a5b20fa6c1aea694a (v0.23.3).
Working task: chatgpt/692-dev-integration-current-20261012.
Proposed unique combined Preview: feature/calendar-zoom-692-dev-integration-20261012 (v0.23.4).

## Integration scope
- Preserve all dev-only v0.20.6 hosted deep-link routing, Vercel rewrites and tests and v0.20.7 first-open Categories warmup on Menu/Me with their tests. Preserve the dev #656 entry-raw reviewed ceiling of 446208 and prior budget provenance.
- Carry exactly the accepted #692 zoom functionality into owner/friend Home calendars: user-synced 7/4/3 days, native finger/trackpad/mouse scroll with day snapping, next/previous month handoff at opposite edges, rapid repeat swipes, accessible keyboard behavior and default 7-day layout.
- Build-size record merges accepted dev #656 and zoom #692 reviews; only Home/aggregate size ceilings inherit documented #692 measured Preview limits. Fresh combined SHA must pass every guard; do not relax absent new measurements.
- Small cleanup of React Hook exhaustive-deps warning for CalendarZoomViewport scrollend handler. No #404 split panel, diary or unrelated feature work. No Appwrite schema/Function or Production changes.

## Delivery gate
Next action: focused CI [verify:focused] on integrated v0.23.4 task, repair failures, squash into stable integration Preview and verify exact-SHA canonical Quality Gate (unit/DOM/browser/dependencies/build/PWA/seven budgets) and Scratch/GIPHY Vercel READY. Then create explicitly approved stable integration Preview → dev PR and merge with previous dev SHA as first parent, an identical accepted source tree and successful canonical-acceptance check. Verify exact dev CI and Vercel staging deployment; never touch main.
User manually accepted original #692 gestures; no new physical-device check is claimed by agent. Keep #692 open until integration verification and documented release boundary.

## Exact combined Preview budget review
- Integration Preview 5d049204 (v0.23.4) compiled, PWA policy passed, all static/size metrics except initialClosureGzipBytes 146051/146050 B (+1) and appAssetsGzipBytes 767025/767000 B (+25). Five other limits pass.
- Separate focused task chatgpt/692-dev-integration-budget-20261012 narrowly reviews these two real combined-tree deltas, preserving previous #692 and #656 measured reviews and all other ceilings. No source behavior changes.
Next action: focused task CI then repair squash into the same stable integration Preview, verify exact canonical and Scratch Vercel READY before approved dev merge. Do not merge main.

## Parallel workflow implementation — #592

Current work: `chatgpt/592-build-parity-20261012` (workflow-only, no app version change), based on dev `d9d2cc1f`. Preserve the #692 historical checkpoint above; the active source and issue comments own live progress. Implementing a sanitized CI/Vercel log comparator with regression evidence from the October 12 incident, aligning the GitHub build job to hosted Node 24, and reporting feature/runtime presence in GitHub logs. Before promoting any gated-Preview mechanism, exact artifact parity, credentials and SHA/alias/canonical-acceptance checks remain unverified. No Vercel settings, dev/main, Scratch or Production changes approved by this task branch.
