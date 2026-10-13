# Session checkpoint

Updated: 2026-10-13 UTC
Current task: #592 trusted CI workflow provenance for future stable Preview expansion.

## Current evidence
- Trusted main `0e39e7315e18e6750843780432dd42d22f940367`, v0.17.4, full Quality Gate #38329110108 SUCCESS, Vercel Production `dpl_6id9FN1ATTmgxANnjD5oHTRwC7JR` READY. `dev` unchanged `d7656e2513e5ee9d339814890cd7f707f18461d6`. Main ruleset #24880070 ACTIVE, no bypass.
- The pending `uid` correction for Vercel's raw v6 LIST lives on `fix/trusted-preview-uid-592-20261013@5cdd5915d0099e04c6b0d7c554a81f96d4210f74`, full Quality Gate #38329581196 SUCCESS on attempt 2; [draft PR #781](https://github.com/carlers/mosaic-life-tracker/pull/781) not merged. Vercel refuses the exact SHA: `Deployment rate limited — retry in 24 hours` (reported 00:54:57 UTC). No accepted new Preview. Existing older pilot Git Preview `dpl_CjsoQ5CoU4At7iRWDqPfC3DmxAYX` READY.
- Default-branch read-only receiver #38329261073 failed closed but identified the old pilot branch's exact SHA/ref. Vercel v6 list uses `uid`, not normalized `id`; the isolated #781 patch handles it without relaxing full authenticated GET. Shadow=true, create=false, alias=false remain unchanged.

## Scoped security follow-on (this task, no provider writes)
- Pinned older pilot `fix/workflow-build-parity-592-20261012@62ae49cc4773cfd57a766b587fa877c4e8717c57` has reviewed `.github/workflows/quality-gate.yml` Git blob `f8a6588644db34ffa20a7c311c00a030ed88a12b`. Trusted main currently has a different legitimate workflow blob, `1694a134282a44234f1b1500d07bd7077bcd9c44`. Do not naively require exact equality with today's main for historical runs.
- Before trusting candidate canonical CI, query GitHub's **exact source SHA** contents metadata for its Quality Gate workflow blob. Fail closed if missing/unreviewed; the specifically allowed historical pilot blob is pinned in immutable trusted receiver code. Never take this hash from the triggering event or candidate branch config.
- Add hostile/missing/changed-blob unit regressions and source-contract assertion. This guards the integrity of the workflow definition, **not** the execution of arbitrary branch scripts or tests; broader branch rollout requires further trust-model review.
- No Vercel API POST, alias switching, Appwrite, application code/version, production, main/dev or ruleset mutation.

## Next
- Commit focused task and run focused gate without triggering Vercel (on `chatgpt/**`). Do not squash into #781's currently frozen stable SHA or promote main while rate-limited. Separately authorized owner-only protection exception required for eventual infra main merge. After quota clears verify exact existing Preview/Git-source readback and initial shadow, then prepare reviewed promotion of this additional hardening. Issue #592 remains OPEN (provider quota, initial live shadow, generalization, 5-promotion evaluation).
