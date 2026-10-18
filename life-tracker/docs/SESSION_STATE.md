# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #975 isolated Oracle Always Free Appwrite self-host host preflight and synthetic deployment preparation.

## Exact branch / boundary
- Starting from protected `dev@87b3a1d027b088e55d4b6dfccb6230b7df053f68` (v0.29.12, #858 accepted); `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` is Production v0.29.1.
- Task branch: `chatgpt/975-selfhost-host-preflight-20261019`; source-only and read-only tools, no user-visible change, app version impact NONE.
- Issue #975 owner approved continuing the isolated Oracle-first proof, not real-account transfer, billable service creation, dev/main promotion or Production cutover. Existing #967 Supabase candidate and #968 long-term dual-server research are preserved.

## Scoped implementation
- Add `scripts/selfhost-preflight.mjs`: Linux ARM64/x64 Appwrite installation minimum CPU/RAM/swap and Docker CLI/Compose v2/daemon host checks. Read-only, deterministic pure assessment, human/JSON output; no installer, network or provider writes, no secret reads or auto-switches.
- Add unit verification for minimum thresholds, fail-closed prerequisites, swap parsing and future x64 portability. Add `docs/SELF_HOSTING_ORACLE_POC.md` with isolated OCI setup, official version-pinned Docker installer, synthetic-only Mosaic bootstrap, ARM64 compatibility and Function/performance validation, encrypted offsite recovery, NAS/laptop cold standby and explicit no-production constraints.
- Register `npm run selfhost:preflight` and link the runbook from docs index. No provider, SDK, RxDB, Function, schema, deployment settings, migration or PWA behavior changes.

## Next action
- Commit one coherent task SHA with `[verify:focused]`, confirm focused CI; then squash into a new stable, non-production Preview branch and require full canonical CI/trusted delivery under existing workflow (even though nothing user-facing changes). No automatic dev/main merge.
- This connected environment has no Oracle Compute management connector and no local Docker daemon. **No OCI provisioning, Docker/ARM64 container execution, performance benchmark, DR restore or device acceptance has occurred**. Real go/no-go requires an operator-owned Always Free VM, verified free billing eligibility and actual synthetic deployment on it.
- For #975 follow up with OCI ARM64 stack/Functions compatibility, observed CPU/RAM/disk/p95, isolated encrypted restore onto a second machine, account privacy and offline sync. Keep #968 active-active research separate.
