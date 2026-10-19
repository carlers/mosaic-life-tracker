# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #975 opt-in GitHub scheduled Oracle A1 capacity and one-shot VM claiming design.

## Source and governance
- Branch `chatgpt/975-github-a1-autoclaim-20261019` forks isolated accepted `refactor/975-local-oci-capacity-watch-20261019@ccf6c95145cfb78c1866fb7987ac56116435454b`, CI #39179848967 and trusted #39180025489 SUCCESS; local command `npm run oci:capacity` is already working on the owner's Fedora CLI and reports Singapore AD-1 OUT_OF_HOST_CAPACITY.
- Protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` and Production `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` untouched. No OCI tenancy or signing key available to ChatGPT; no permission to promote Preview to main or create billed resources.
- GitHub scheduled workflows only execute from the default branch. The staged scheduled workflow on a nondefault Preview is **DORMANT**. Activation requires future explicit owner approval for default-branch workflow deployment, secure GitHub encrypted secrets and OCI dedicated user/compartment/quotas.

## Work
- New `scripts/oci-a1-autoclaim.mjs`: monitor existing 2 OCPU/12 GB Singapore A1 capacity report; optional full opt-in launch only if positive available count, exact scheduled default-branch context, dedicated compartment/quotas/free-tier confirmations, no existing A1 in compartment (including stopped), compatible Ubuntu 24.04 image, valid subnet and public SSH key. One no-retry launch, 50GB disk, **no public IPv4**, no extra volumes/paid shape fallback, no Appwrite deployment.
- New `.github/workflows/oci-a1-autoclaim.yml`: hourly at minute 17, no PR trigger, encrypted key only as step secret, ephemeral OCI CLI/profile, contents-read and serialized concurrency. Main branch only once separately promoted; launch variable disabled by default.
- New `tests/unit/ociA1Autoclaim.test.ts`: synthetic OCI CLI and safety/duplicate/owner guards.
- New `docs/OCI_GITHUB_A1_AUTOMATION.md` with manual security/activation gates and residual cost risks; package command + docs index/local watcher reference.

## Next action
- Commit [verify:focused] and resolve tests, then squash into isolated stable Preview for canonical Quality Gate and trusted delivery. Do not enable GitHub schedule, write GitHub secrets, create OCI resources or promote to dev/main without a separate approval.
- When ready: owner creates least-privilege OCI API key in dedicated compartment, verifies Always Free quotas and image/subnet, adds GitHub secrets and variables, and explicitly approves default-branch activation. Even with fixed shape, script **cannot guarantee zero cloud charges**. Keep #975 open, and #967 Supabase fallback independent.
