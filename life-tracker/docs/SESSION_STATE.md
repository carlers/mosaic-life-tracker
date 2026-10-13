# Session checkpoint

Updated: 2026-10-13 UTC
Current task: #592 live trusted Preview shadow readback failure.

## Verified
- Main PR #775 merged with merge commit `1796f6636cd3d22f1b0de1ab9e08b8bacb89cf8d` on October 13, preserving exactly six infrastructure/docs/test files, main v0.17.4, current dev `d7656e2513e5ee9d339814890cd7f707f18461d6`. GitHub main full Quality Gate #38326773317 SUCCESS; ruleset #24880070 active/no bypass.
- Vercel rejected exact new main Production SHA with `Deployment rate limited — retry in 24 hours`. Previous Production `dpl_Enm5D8PdkgsTzVMvyfiaWRWkkv9K` READY at earlier main `033e85ce...`; do not claim current main is deployed. Do not create or force deploy while rate limited.
- Owner configured `mosaic-preview-auto` shadow secret and repo flag. Rerunning accepted pilot Quality Gate #38318701965 (attempt 2) succeeded and triggered `Trusted Preview Delivery #38328093235`. Logs prove enabled=true, create=false, alias=false; authenticated receiver authorized exact main/green source but failed closed `Trusted Preview creation disabled: reuse-only shadow mode` after finding no list candidate. No Vercel POST or alias write occurred.
- Pilot branch `fix/workflow-build-parity-592-20261012@62ae49cc4773cfd57a766b587fa877c4e8717c57`, Vercel official Git Preview `dpl_CjsoQ5CoU4At7iRWDqPfC3DmxAYX` READY, strict full identity confirmed by separate provider connector. Scoped Vercel list through connector includes candidate; unknown why receiver selected none. Suspicion: raw LIST target omitted vs normalized null.

## Scoped code refinement
- Accept a *missing* target only while nominating a project-scoped list candidate; full authenticated deployment GET still **requires explicit Preview/non-Production target**, correct source, project, repo, branch, SHA and READY.
- Print only aggregate bounded list-scan counts on no candidate so another rejection can be diagnosed without logging credentials or provider metadata. Add regressions.
- Do not enable `MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED` or `MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED`. Existing Git Preview remains intact.

## Next action
- Focused task CI, squash into main-based safety stable Preview and full canonical/Preview provider check where quota allows. An additional main-only security fix cannot be merged without separate owner-approved boundary; avoid speculative repeated exemptions. Investigate actual list shape via next trusted receiver log, finish reuse-only shadow and quota/Production readiness, then remaining #592 branch generalization, hosted creation, alias, five-promotion verification.
