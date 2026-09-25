# Session checkpoint

Updated: 2026-09-25
Current task: Activate the new `dev` integration branch after the CI/CD branch-model migration
Status: `dev` now exists at the accepted migration tip; this commit activates a new push event so branch-triggered CI/deployment behavior can be verified.
Next action: verify the GitHub Quality Gate run for `dev` and then verify the resulting Vercel Preview deployment.
Blockers: Vercel project settings and resulting deployment status are external and require dashboard/service access.

## Constraints

- `main` is production and receives full canonical verification plus Vercel production deployment.
- `dev` is integration/staging and receives full canonical verification plus Vercel preview deployment.
- `feature/*` receives full canonical verification plus Vercel preview deployment.
- `chatgpt/*` and `codex/*` are temporary AI implementation branches with focused CI and no automatic Vercel deployment.
- Other branches receive no automatic Vercel deployment.
- Preserve the existing canonical checks, caches, concurrency, shards, and acceptance gate.

## Completed substeps

- Renamed the verification workflow to `.github/workflows/quality-gate.yml` and migrated its branch triggers.
- Replaced preview classification with canonical and AI branch classification.
- Added regression coverage for CI branch classification.
- Changed Vercel deployment configuration to an explicit deny-by-default branch policy.
- Updated delivery, testing, versioning, and project-reference documentation to remove the deployment-only preview model.
- Created `dev` from the accepted CI/CD migration tip.
- Added this documentation checkpoint commit on `dev` to trigger branch-based CI.

## Working set

- .github/workflows/quality-gate.yml
- life-tracker/scripts/ci-classify.mjs
- life-tracker/tests/unit/ci-classify.test.ts
- life-tracker/vercel.json
- life-tracker/docs/DELIVERY.md
- life-tracker/docs/TEST_WORKFLOW.md
- life-tracker/docs/VERSIONING.md
- life-tracker/docs/PROJECT_REFERENCE.md
- life-tracker/docs/SESSION_STATE.md

## Verification

- Automated: canonical acceptance passed for the exact migration SHA before `dev` activation.
- Browser/device acceptance: manual Vercel branch deployment checks remain pending.
- `dev` activation CI: pending verification after this push.
