# Session checkpoint

Updated: 2026-10-12
Current task: #692 accepted mobile Calendar zoom — integrate with live dev.
Integration source: dev@b878519bd52da16368b5da2b407f82f326ab2683 (v0.20.6) and accepted #692 Preview feature/calendar-zoom-692-20261012@b70bda97583d1b421512ac8a5b20fa6c1aea694a (v0.23.3).
Current task branch: chatgpt/692-dev-integration-20261012; intended stable combined Preview: feature/calendar-zoom-692-dev-integration-20261012.
Planned unique combined Preview version: v0.23.4, required because accepted dev deep-link changes entered after original #692 branch diverged. No main/Production promotion authorized.

## Integration contract
- Preserve dev-only accepted signed-out hosted deep links v0.20.6: protectedRoutes, Vercel SPA rewrites and hosted/route gesture regressions.
- Apply accepted #692 mobile Calendar zoom 3/4/7 days, day-by-day native touch, mouse and trackpad snapping; edge month handoff and two-frame swipe release; owner/friend layout and keyboard/accessibility coverage.
- Keep unrelated #404 desktop side panel and concurrent diary features on their own branches. No Appwrite schema, Function or Production mutations.
- Reconciled source from exact baseline and live dev without copying stale Preview SESSION_STATE or overwriting dev-only routing. Package/lockfile dependencies unchanged; version becomes 0.23.4 in all three version files.

## Required checks and promotion
Next action: focused task verification [verify:focused] against combined tree; repair; squash into named stable integration Preview; verify exact stable SHA canonical Quality Gate (DOM, browser shards, checks, production build/PWA, seven size budgets) and Vercel Scratch/GIPHY READY. Then create approved stable integration Preview → dev promotion PR, verify first parent and identical accepted tree; merge with descriptive two-parent commit; verify exact dev CI and Scratch Vercel deploy.
Manual physical-device gestures were accepted by user in #692 discussion but no assistant device testing performed. Do not merge main or close #692 before dev acceptance and documented next release boundary.
