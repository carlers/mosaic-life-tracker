# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 provider-neutral eight-domain backend parity audit supporting Supabase Free and OCI Appwrite evaluation.

## Baseline and boundary
- Branch `chatgpt/967-provider-parity-audit-20261019` from previously accepted isolated Supabase stable `refactor/967-signed-rpc-denial-matrix-20261019@0fdd3a5e190a9ccad1ebe0d3beeaa75ec779c869` (PR #1013). Protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1`, `main@b952f71ecd2add3172f90104bc0e856a2648ccc9`; neither is to be changed.
- Owner direction: #967 Supabase migration and #975 OCI Always Free Appwrite self-host remain **reversible parallel options**. No selection, auto-launch, cloud write, runtime provider import, production/user migration or dev/main promotion authorized. Version impact NONE.

## Current work
- Add `docs/BACKEND_PROVIDER_PARITY.md`: trace all eight current RxDB owner-scoped collections to source, distinguish Supabase local-only task/category proof from remaining six domains, record OCI scheduler status, compare security, Auth, offline/CAS, DR, cost and old-PWA cutover gates and define next disposable experiments. This is a source/read-only audit, not an implementation milestone.
- Read-only hosted Supabase check on 2026-10-19: `mosaic-dev` ACTIVE_HEALTHY, four RLS-enabled experimental tables at zero rows; two authenticated-callable SECURITY DEFINER CAS Advisor warnings remain open.
- Read-only private scheduler Actions check on 2026-10-19: five manual runs, zero schedule events. Last manual prerequisite audit passed, A1 capacity unavailable; autonomous auto-claim not established.

## Verification and next action
- GitHub exact-source commit with `[verify:focused]` and focused documentation/contracts gate **not yet verified at checkpoint write**. After task focused green, squash only into a **new isolated stable Preview** for canonical CI/trusted delivery. Do not promote to `dev` or `main`.
- Review security of privileged Supabase RPCs without changing grants, then choose next synthetic parity/hosted Auth probes based on evidence. Keep #967 and #975 OPEN; note remaining manual/hosted approvals and actual CI/deployment outcomes in their issue checkpoints.
