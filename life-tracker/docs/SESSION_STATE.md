# Session checkpoint

Updated: 2026-10-13 UTC
Task: #592 trusted default-branch Preview receiver safety hardening.

## Verified baseline
- Owner's one-time Option B main bootstrap PR #772 merged `033e85ce8e78ef109dc15866a971ee0a0dba4b7c`; app version remains 0.17.4, main Quality Gate #38321997796 SUCCESS, Production Vercel `dpl_Enm5D8PdkgsTzVMvyfiaWRWkkv9K` READY, ruleset #24880070 restored and active with zero bypass actors.
- Existing main receiver remains OFF/unprovisioned. Legacy unsafe pilot is hard-disabled on dev. No unattended deployment secret or alias switch enabled.
- First safety Preview `fix/trusted-preview-shadow-safety-592-20261013@eee4966463e25a9fffb7001da0f3169e551bf1cf`: full Quality Gate #38322580282 SUCCESS and Git-hosted Scratch Vercel `dpl_7yPaxkxEbgkNgWKouBPucZ9Wpda3` READY. Draft main PR #775 unmerged; prior Option B approval applied only to #772.

## Current security refinement (no app/version change)
- Pin setup-node to immutable official v4.4.0 commit verified via GitHub.
- Require trusted main checkout still equals live main HEAD as well as workflow github.sha; fail stale main source.
- Exclude historic CLI `HEAD` canaries from shadow reuse. Validate only official Git-hosted exact-branch, exact-SHA READY Preview.
- Add regressions; keep separate default-OFF Vercel GitSource creation and alias flags. Do not deploy from this code while not present on main.

## Next
- Focused task CI, squash to existing #592 safety stable Preview, full canonical and Git Preview READY. Update #775 evidence. No additional main exception, credentials, Production or Appwrite mutation without separate required approvals. #592 still open for shadow credential provisioning and live negative trials, Preview-only provider contract/quotas, alias cutover and branch generalization.
