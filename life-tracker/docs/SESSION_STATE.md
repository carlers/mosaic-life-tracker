# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #975 local Oracle Always Free A1 capacity watcher while Singapore is out of hardware.

## Boundary
- Forked from accepted isolated `refactor/975-arm64-datastores-20261019@3473ca548e6f428f9cdf22587b7a358a02d47160`, full canonical #39175178419 and trusted Preview #39175314432 successful; prior native ARM64 app/runtime/datastore proofs all passed.
- Protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1`, Production `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged.
- User has configured an OCI VCN/public subnet and attempted A1 VM in Singapore AD-1; Oracle returned OUT_OF_HOST_CAPACITY. No VM created. No Oracle credentials or tenancy access through ChatGPT. No billed resources authorized.

## Work
- New source-only `scripts/oci-capacity-watch.mjs`: local OCI CLI read-only IAM AD list and Compute capacity report for Singapore A1 2 OCPU/12GB, CLI profile kept local, 60-min watcher/once mode (15-min minimum), advisory result status/positive count only, fail-closed errors, never launch VM or print root OCID/CLI stderr.
- New unit tests `tests/unit/ociCapacityWatch.test.ts` for argument constraints, tenancy/AD validation, report statuses/unknown safety, exact command allowlist and secrets suppression.
- Package script `oci:capacity`, docs guide `docs/OCI_CAPACITY_WATCH.md`, OCI runbook/docs index links. App runtime/version impact NONE.

## Next action
- Verify focused CI then squash to a new isolated stable Preview for canonical CI/trusted READY. No real OCI report can run until user's local CLI credentials are configured; never claim live host availability. Track #975. Separately resume #967 Supabase REST/auth/RxDB prototype on its own accepted isolated branch, without touching `dev`, `main`, Appwrite Scratch, Production, real accounts or overlapping UI files.
