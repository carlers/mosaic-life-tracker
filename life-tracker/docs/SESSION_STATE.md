# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #975 — unified disposable Appwrite OCI/NAS preflight, image check, and health probe.

## Boundary
- Forked from exact dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1 (v0.29.12, documentation-contract advisories already promoted and dev CI/READY verified). Production main@b952f71ecd2add3172f90104bc0e856a2648ccc9 remains unchanged.
- Owner unable to provision OCI VM currently; authorized continued safe source-only work, not Production/backend edits.
- Previous independent accepted stable Previews: host preflight PR #976 at 9fc9e6bf588bfba3b95c815ed460f61497238933; image audit PR #979 at 1a649497d43ac9690f70756563b25b610bee8ce5. Neither was promoted to dev.

## Coherent task
- Consolidate those two tested tools under one isolated task branch `chatgpt/975-unified-offline-readiness-20261019` to allow running the entire readiness checklist from a single source ref.
- Add bounded unauthenticated `scripts/selfhost-health-probe.mjs` + isolated unit tests. Exact HTTPS or loopback Appwrite test host + explicit double confirmation required. Reject managed Appwrite Cloud endpoints. Max 100 GET requests / 4 concurrency, only /v1/health/version; no auth token, user data, HTTP body, container startup or deployment.
- Fix an earlier runbook Markdown linebreak serialization artifact and integrate a health probe guide / image audit; package scripts and docs index complete.
- No frontend Appwrite SDK, PWA, schema, Function, Production, Scratch or DR snapshot mutation. No version impact.

## Verification
- Pending: focused [verify:focused], stable Preview canonical CI and trusted READY; none may be presumed successful until observed.
- This environment has no Docker daemon, registry network or Oracle OCI Compute connector; no live ARM64 compatibility, real SDK behavior, Appwrite deployment, p95 CRUD, CPU headroom or independent cross-host recovery proof yet.

## Next action
- Review focused logs and repair any failures, squash to a single stable isolated Preview with canonical gate and trusted delivery. Keep #975 open. Once operator provides an Always-Free-eligible disposable VM, run read-only preflight, registry audit, official Appwrite installer/bootstrap, bounded health probe, then full synthetic signed-in isolation/Function/DR/performance scenarios. Never promote to dev/main or cut over live users without separate explicit approval.
