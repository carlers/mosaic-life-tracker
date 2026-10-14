# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 trusted CI-first prebuilt writer — one fresh protected canary after CLI scope fix.

## Verified
- Owner merged protected infra-only [PR #825](https://github.com/carlers/mosaic-life-tracker/pull/825) with merge commit `ed9787b931c5e65fb8c53474151fd5d249f88fff`. Exact [main Quality Gate #38535006485](https://github.com/carlers/mosaic-life-tracker/actions/runs/38535006485) full SUCCESS; exact Production Vercel `dpl_J6s5TRKKT3kbQAnM2EgTDuPMB1Sd` READY, app v0.17.4 unchanged; main ruleset #24880070 ACTIVE with ZERO bypass actors; dev `f3d9558feca499e53c310c5a37be2794717bccf6` unchanged.
- The approved canary branch `fix/592-trusted-archive-20261014@64625a0ef6dc4850ce259c8a0d3586ea4d858025` passed [full canonical #38529824578](https://github.com/carlers/mosaic-life-tracker/actions/runs/38529824578) and Vercel project-scoped Git deployment history remained EMPTY, proving no pre-CI Git builds. [Trusted Preview Delivery #38530036833](https://github.com/carlers/mosaic-life-tracker/actions/runs/38530036833) read-only receiver SUCCESS but protected writer failed BEFORE Vercel creation with CLI user GET 404; this second failure matched the earlier `--scope` failure.
- Protected main now omits BOTH `--team` and `--scope` in CLI argv, retaining exact `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, reviewed project.json, `--prebuilt --target=preview`, route/SHA/ZIP provenance, duplicate checks and alias OFF. The fix passed focused and full tests but has NOT yet executed the live provider writer. Old failed workflow runs must not be rerun.

## This canary task
- Add a security regression proving a later green workflow cannot borrow older canonical-suite evidence or use an untrusted app's spoofed green check, but accepts its own exact new green suite.
- Test/checkpoint only: no app code, app version, Vercel project, branch-deployment rules, environment, secrets, size budgets, routing, backend, Production/dev, or alias modification.

## Next action
- Focused task CI → squash stable canary → full canonical. Demand ZERO early Git deployments for accepted SHA; inspect default-main Trusted Preview Delivery and writer. Permit exactly one accepted CI-first static `--prebuilt --target=preview` provider creation, verify READY with matching SHA/project/route/Scratch/GIPHY/PostHog, security headers and deep links, no second build and no alias. On failure inspect exact writer logs and provider history BEFORE any new push or retry. Then check retry/stale/rollback, expand trusted stable categories, one approved real feature Preview→dev acceptance. #592 remains OPEN. No device/manual check claimed.
