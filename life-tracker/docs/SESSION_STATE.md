# Session checkpoint

Updated: 2026-09-24
Current task: Migrate CI/CD from the legacy preview branch model to main/dev/feature plus AI task branches
Status: implementation complete; final local and remote verification is required.
Next action: run syntax, focused classifier tests, project contracts, lint, unit/handler/DOM tests, build, and inspect the committed diff; then commit with [verify:full] and wait for canonical acceptance.
Blockers: Vercel deployment status for main/dev/feature must be verified externally after the accepted SHA is deployed.

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

- Automated: the first full run exposed two stale workflow-documentation assertions; fixed in the follow-up. The next commit requests another full canonical verification with [verify:full].
- Browser/device acceptance: manual Vercel branch deployment checks remain pending.
