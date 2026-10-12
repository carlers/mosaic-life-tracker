# Session checkpoint

Updated: 2026-10-12
Current task: fix signed-out hosted deep-link navigation, v0.20.6 Preview only. No dev/main promotion.

## Direct deep links on Vercel
- Base: dev@dbde9515ecb611082f191d39e5ef71cfcecde3bc (v0.20.5). Task: `chatgpt/signed-out-deep-links-20261012`; intended stable Preview: `fix/signed-out-deep-links-20261012`.
- Root cause: `vercel.json` had only `/settings` and no nested Settings rewrite, so refreshing `/settings/notifications` failed at hosting before `AppLayout` could redirect signed-out users to `/login`.
- Scope: add explicit nested Settings and Bucket List rewrites plus public password-reset rewrite; keep static assets outside SPA fallback. Unknown `/settings/*` children resolve through the guarded shell to Settings for signed-in users and login for signed-out users. Preserve confirmed-auth vs offline-cached identity behavior.
- Patch Preview candidate: 0.20.6. Regression: `tests/unit/hostedProtectedRoutes.test.ts` covers all registered protected routes, public routes and no global catch-all.
- Next: task focused CI `[verify:focused]` → squash into stable Preview → canonical acceptance + Vercel READY → browser/device signed-out direct-link checks on registered Preview alias. Do not merge to dev/main without approval.

## Prior integration
- #656 first-open sheet fixes were integrated into dev as v0.20.5 at dbde9515. Follow issue #656 and merged PR history for complete verification and acceptance details.
- #645 source map/index remains a separate discovery workstream. Preserve accepted #640 cold-open Day View behavior, #655 PWA behavior, and all unrelated features.
