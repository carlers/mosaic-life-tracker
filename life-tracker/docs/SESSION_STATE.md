# Session checkpoint

Updated: 2026-09-25
Current task: Expand primary route swipe navigation to the full route viewport
Status: Fixed the non-Home route swipe surface so it covers the full viewport area above the fixed bottom navigation, including pages with short content.
Next action: verify the focused regression and exact-SHA Quality Gate acceptance, then deliver the fix to `dev`.
Blockers: Local runtime execution is unavailable in this environment; remote CI is the executable verification path.

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
- Updated `PrimaryRouteSwipeSurface` to reserve the full route viewport height on non-Home pages.
- Added regression coverage asserting the non-Home swipe surface spans the route viewport even when page content is short.

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

- Automated: regression test added; focused execution is pending remote CI because local repository execution is unavailable.
- Browser/device acceptance: real touch swipe verification remains required after deployment.
- Canonical acceptance: pending for the final fix SHA.
