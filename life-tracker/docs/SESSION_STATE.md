# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #975 isolated GitHub Actions OCI A1 auto-claim variable-wiring repair.

## Verified baseline and boundaries
- Accepted isolated stable `refactor/975-github-a1-autoclaim-20261019@62e1be4b19c7947f48c3282454494637245a1e7c`: PR #993 squash merged; focused #39185149564 SUCCESS, canonical #39185433786 SUCCESS, trusted Preview #39185602690 SUCCESS.
- `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` and `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` remain unaffected by OCI work. The hourly GitHub schedule is DORMANT on nondefault Preview; no OCI credentials, instance launch, backend migration, GitHub Secrets write or production promotion.
- Owner ran the local OCI capacity report on Fedora; Singapore A1 2 OCPU / 12 GiB was OUT_OF_HOST_CAPACITY at 2026-10-19T01:07:01Z. Later availability is unverified.

## Current scoped repair
- In `.github/workflows/oci-a1-autoclaim.yml`, replace the malformed computed environment-map key with literal `MOSAIC_OCI_QUOTA_CONFIRMED`, retaining a fail-closed `'NO'` default.
- Add an exact workflow-to-controller opt-in variable wiring regression to `tests/unit/ociA1Autoclaim.test.ts`.
- No shape/disk/region/IAM/launch change, no version change or manual infrastructure action.

## Next action
- Run focused Quality Gate on the coherent task commit, squash to isolated stable Preview after green, then verify full canonical CI and trusted READY for that new stable SHA. Report exact results.
- Activation remains separately gated: owner-created least-privilege OCI identity, compartment quotas/free-tier and billing verification, encrypted GitHub Actions secrets, plus explicit authorization before any default-branch scheduling or actual VM launch. Keep #975 open and Supabase #967 independent.
