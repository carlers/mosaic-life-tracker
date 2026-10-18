# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #975 synthetic native ARM64 PostgreSQL, Redis and ClickHouse service smoke.

## Boundary
- Base is isolated stable `refactor/975-node-runtime-arm64-20261019@6ee676a934a0edadbb44cdf4b2d5520d639a7924` after real ARM Node 18/22 success #39174450297, focused #39174450275, canonical #39174561267; trusted Preview evidence remains to be checked.
- Protected dev `a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` and Production main `b952f71ecd2add3172f90104bc0e856a2648ccc9` remain unaffected. The user has no OCI VM available yet.
- No credentials, real user data, provider writes, Appwrite service, SDK migration, app version impact or release approval.

## Work
- Task branch `chatgpt/975-arm64-datastores-20261019` adds a branch-limited GitHub ARM64 job that starts pinned Appwrite PostgreSQL, Redis and ClickHouse images on an internal Docker network with no published ports, two shared CPU indices, bounded memory and only synthetic records, then checks each read-back and tears down containers.
- Add `docs/SELF_HOSTING_ARM64_DATASTORES.md` describing proof boundaries and link from OCI runbook/docs index.
- Real Appwrite service startup, function invocations, 2 OCPU OCI performance, encrypted R2 DR and NAS restoration all remain unverified.

## Verification
- Task focused, dedicated native test, stable canonical and trusted Preview pending. Do not infer deployment success from synthetic datastore starts.

## Next action
- Investigate actual native datastore job outcomes and fix any infrastructure-independent failures, then squash only into isolated stable Preview after focused success, require canonical CI and trusted READY; update #975 checkpoint. Never promote to dev/main, bill Oracle, move data or modify Production without separate approval.
