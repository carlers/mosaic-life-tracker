# Session checkpoint

Updated: 2026-09-27

Current task: make Mosaic independently forkable on `chatgpt/mosaic-bootstrap`, targeting
stable Preview `security/disaster-backups`.

Status: implementation is complete pending canonical verification and stable delivery. The
bootstrap has not been run against any live Appwrite project; production Mosaic and the
unrelated empty Appwrite project were not mutated.

## Completed
- Added `infrastructure/mosaic-backend.mjs` as the versioned fresh-project manifest for the
  seven active TablesDB tables, indexes/permissions, and `task_images` Storage bucket.
- Added `npm run mosaic:bootstrap`. Given an explicitly selected empty Appwrite project,
  endpoint, and temporary API key, it refuses non-empty targets, creates the backend, deploys
  `message-action`, registers Web platforms, and writes fork-specific `.env.local`.
- Added optional `--with-dr` provisioning for the schedule-disabled DR Function when R2 and
  encryption secrets are deliberately supplied. R2 remains unnecessary for ordinary forks.
- Added `--platform-only` for adding later hosting domains without touching backend data.
- Added fork safety: unconfigured non-official builds resolve to a deliberately invalid
  Appwrite endpoint/project rather than the original Mosaic production backend. Official
  GitHub/Vercel builds retain the existing production fallback through build identity.
- Added manifest/bootstrap regression coverage and a maintainer-continuity runbook in
  `docs/FORKING.md`.
- Updated README, documentation index, delivery guidance, and environment example for the
  fork workflow.

## Constraints
- Fresh bootstrap is not an in-place migration tool and must never overwrite an existing
  community.
- A failed partially-created bootstrap should be discarded by recreating the disposable
  empty project rather than force-resuming into uncertain state.
- Provisioning keys are temporary administrator credentials and must never be committed or
  exposed through `VITE_*`.
- Personal user backups restore personal data but not reciprocal friendships/messages/login
  identity; full-community continuity still requires the administrator DR package.
- Do not enable the production `dr_backup` schedule before the isolated DR restore drill.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

## Remaining verification
1. Run focused/bootstrap tests and lint/build checks.
2. Put `[verify:full]` on the exact final task SHA and wait for canonical acceptance.
3. Squash-deliver to `security/disaster-backups`, then verify stable Quality Gate and
   Vercel Preview.
4. Keep the existing external DR blocker separate: R2 credentials/encryption escrow and the
   restore drill are still required before automated disaster backups can be enabled.

Next action: complete verification and repair any SDK/schema incompatibility found by CI.
