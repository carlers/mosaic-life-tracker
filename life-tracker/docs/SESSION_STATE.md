# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 — prepare a dev-based, quiet second-branch CI-first Preview pilot.

## Verified
- Current protected `main@31d412a93f1c93ba05f8e54b0de950c1344e671c`: Quality Gate #38543710215 SUCCESS; Vercel Production `dpl_5cND3FRZgv9exDZNu9xXaY6qdJ73` READY. Ruleset #24880070 ACTIVE, ZERO bypass; dev unchanged `f3d9558feca499e53c310c5a37be2794717bccf6`. Other #784 guard/audit policy is separately tracked.
- First isolated canary `fix/592-trusted-archive-20261014@61e6728935ef734eab448da291a12a485aabe7b3`: protected Trusted Delivery #38539354517 attempt 1 created exactly ONE static CI-first Preview `dpl_DtqNxRakFrBXCnrYy5xYSZ7QocnR` READY, no Git build/aliases. Trusted Delivery #38544069361 later reused it successfully without provider POST.
- Main-based [PR #837](https://github.com/carlers/mosaic-life-tracker/pull/837) is OPEN, awaiting owner's new temporary PR-only ruleset exception; it limits trust to existing canary and exactly one named feature pilot `feature/592-prebuilt-pilot-20261014`. Last stable `fix/592-main-two-branch-gate-20261014@64e020f7bb644818857e0a532d04b0d937737b4a` full canonical #38547254157 SUCCESS; predecessor app-identical preview at `e50177fa` READY, final test/doc-only SHA has NO provider Preview (do not falsely claim exact-SHA READY).
- This quiet source task, based on dev v0.23.4, modifies ONLY `vercel.json` deploymentEnabled feature class: replace `feature/*:true` with `feature/!(592-prebuilt-pilot-20261014):true` and exact `feature/592-prebuilt-pilot-20261014:false`. It retains main/dev Git-auto, all other feature/fix/perf/security/refactor builds, task quiet, routing and headers byte-for-byte. No app/version/backend/provider secret changes.

## Next action
- Run focused CI for this `chatgpt/**` task, then HOLD the named feature pilot until #837 is owner-merged and current main canonical/Production READY with zero bypasses.
- To avoid an unsolicited Vercel Git build, NEVER create `feature/592-prebuilt-pilot-20261014` at the original dev HEAD (whose config still enables `feature/*`). After owner main acceptance, create the named branch at an already-verified SHA containing opt-out `vercel.json` before the first push, then verify no Git Preview on red/green, full canonical, protected writer exactly one CLI READY and same-SHA reuse.
- Stop rollout on any provider Git overlap/error. `MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED=false` disables the writer; restoring ordinary Git builds requires reverting the pilot config via reviewed branch change. Alias stays OFF. Do not promote dev/main without separately approved user action. Issue #592 OPEN; device Scratch login remains untested.
