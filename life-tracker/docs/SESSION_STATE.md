# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #975 separated private GitHub scheduler for OCI A1 capacity monitoring and guarded one-shot claim.

## Verified source and branch
- Isolated stable `refactor/975-github-a1-autoclaim-20261019@561d10a778b5ddc8227df39a7ab0521dcac1db4b` accepted: #995 focused Quality Gate #39186397899 SUCCESS, stable full #39186492717 SUCCESS, trusted Preview #39186643986 SUCCESS, exact source READY. Original #993 auto-claim implementation remains staged, not activated.
- Mosaic Production `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` and protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` have not been changed by this work. Issue #975 remains OPEN; #967 Supabase independent.
- A standalone private scheduler avoids promotion to Mosaic's Production default branch. GitHub still requires the independent scheduler's default branch for hourly runs.
- No OCI API key, live Oracle capacity result, existing private scheduler repository, GitHub Actions secrets or approved VM launch available in connected chat. Latest user-reported check OUT_OF_HOST_CAPACITY at 2026-10-19T01:07:01Z.

## Scoped work
- Add fixed second trusted context `carlers/mosaic-oci-a1-scheduler` to the controller's exact scheduled-main repository allowlist.
- Add private scheduler workflow template under `ops/oci-a1-scheduler/.github/workflows/` requiring private repository + trusted default ref, pinned Mosaic source SHA, one shared serial concurrency group, default observe-only variables, OCI encrypted secrets and never a public IPv4 assignment.
- Extend controller/template regressions; add concrete step-by-step setup and confirmed Oracle compute+boot quota family names to the operator guide.
- No changed Mosaic PWA, Appwrite backend, schema, functions, secrets, OCI instance, provider choice, resource shape, version, `dev` or `main`.

## Next action and approval gates
- Coherent task branch [verify:focused], then squash to isolated stable Preview and require full canonical Quality Gate plus trusted READY. Replace the template's source SHA placeholder only when the accepted stable SHA exists.
- **Manual owner prerequisites:** create the private scheduler repository (exact name), independent least-privilege Oracle IAM user/key, dedicated compartment/verified enforced quotas, image/subnet/public SSH selection, cost alerts, then encrypted scheduler Actions secrets; perform default observe-only dispatch. Requires separate explicit owner authorization before enabling any scheduled OCI launch or promoting protected Mosaic branches.
- Report actual CI, Preview and account-setup state. No claim of successful automated OCI provisioning. Keep #975 OPEN.
