# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #975 — read-only registry architecture proof for isolated Oracle Appwrite self-hosting candidate.

## Starting boundary
- Owner-approved documentation-only dev promotion #978 merged at dev a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1 with exact accepted tree, Quality Gate #39170095087 SUCCESS, matching dev Vercel READY. Production main b952f71ecd2add3172f90104bc0e856a2648ccc9 unchanged.
- #975 host installation minimum prerequisite probe / OCI runbook accepted on isolated stable refactor/975-selfhost-host-preflight-20261019@9fc9e6bf588bfba3b95c815ed460f61497238933, **not merged into dev**. No OCI account or Docker VM available to connected chat.
- This task branch chatgpt/975-image-architecture-audit-20261019 is forked from promoted dev. Source-only; no PWA version change; no Appwrite live/scratch/Production write or CI/security relaxation.

## Scoped change
- New read-only scripts/selfhost-image-audit.mjs evaluates linux/arm64 and linux/amd64 support for generated Docker Compose images and explicitly supplied dynamic Function runtime images. Unknown / missing manifest metadata fails closed, no registry writes or container runs.
- New unit tests cover image index/verbose manifest parsing, unsupported pins, missing build-image metadata and options.
- New docs/SELF_HOSTING_IMAGE_AUDIT.md guides synthetic-only operator checks; npm script and docs navigation link.

## Verification status
- Task focused CI, canonical stable Preview and trusted delivery pending; actual registry audit / OCI VM / ARM64 docker images / Functions / backup restore **not executed or verified** in this environment.

## Next action
- Commit coherent task with [verify:focused]; review lint/unit results. On green squash to isolated stable Preview for full canonical and trusted delivery. Keep #975 open. Actual OCI free VM availability, live synthetic image/function/runtime/API compatibility, memory headroom and NAS/laptop restore remain mandatory before any Production cutover. Do not merge to dev/main without separate approval.
