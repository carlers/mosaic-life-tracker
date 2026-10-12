# Session checkpoint

Updated: 2026-10-13 UTC
Current task: #592 trusted Preview receiver, infrastructure-only main bootstrap complete; next safety refinement is a task/Preview candidate.

## Verified live state
- Owner-authorized Option B PR #772 merged as `main@033e85ce8e78ef109dc15866a971ee0a0dba4b7c`, with exactly nine infrastructure/tests/docs paths, app version 0.17.4 unchanged. `dev@d7656e2513e5ee9d339814890cd7f707f18461d6` remains 0.23.4.
- Main Quality Gate #38321997796 SUCCESS including canonical and both browser shards; matching Vercel Production `dpl_Enm5D8PdkgsTzVMvyfiaWRWkkv9K` READY. Ruleset #24880070 active, no bypass actors; PR/status/deletion/non-fast-forward protections restored.
- Main-owned `workflow_run` receiver exists but `MOSAIC_TRUSTED_PREVIEW_ENABLED` and alias switch are OFF/unprovisioned. Legacy untrusted branch pilot remains disabled on dev; no Vercel token granted to new unattended receiver.

## Scope of current safety task
- Keep repo's trusted source boundary, app, version, provider environments and branch promotion rules unchanged.
- Add a third independent default-OFF hosted-creation switch. First authorized shadow must reuse an exact existing READY Preview or fail closed; never POST a new Vercel deployment accidentally.
- Reject uncertain deployment target values in provider readback and unexpected POST responses. Add pure negative regression tests and update the trusted receiver runbook.
- Do not permit new shadow credentials or alias changes on main before promotion of this verified guard and controlled environment review.

## Next action
- Focused task CI, then squash into a main-based stable Preview for full canonical and normal Vercel READY. Do not merge another direct-main exception or enable any secret/flag on implied approval. #592 remains OPEN for provider Git link shape, exact-SHA/Scratch/idempotency/quota/CI-red shadow acceptance, alias handoff, branch generalization, regular audits and five-promotion sample.
