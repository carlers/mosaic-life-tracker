# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #889 / #526 isolated **v0.17.5 legacy Production-client compatibility hotfix preparation**, no protected Production action authorized.

## Exact source boundary
- Start from current protected `main@bb58300052dc4c85974d97779e2b257ec4f28c7d` v0.17.4. Historical `src/lib/syncMapping.ts` forwarded unknown Appwrite fields to strict RxDB schemas for the six subscribed collections (tasks, categories, diary, settings, friendships, messages).
- This task changes only the legacy mapper to strip remote fields not in existing `KNOWN_FIELDS` and adds Diary/message additive-column regression tests; old-reader fallback metadata remains sourced from the original server row. No Appwrite schema, Function, storage, device/PWA update or authentication change.
- Preview hotfix candidate version **0.17.5** in package.json, package-lock.json and appVersion.ts. Separate from already-accepted dev **0.29.1**; do not downgrade `dev` or promote this historical branch there. Treat this as a possible standalone Production bridge, not the target pre-1.0 feature release.
- User authorized isolated preparation, but **not** stable→dev/main merge, Production Function/migration activation, or release tag. Real installed-PWA update/retirement remains a hard gate even if 0.17.5 passes CI.

## Verification and continuation
- Request task-branch focused CI once coherent tests are committed. Fix failures before preparing the stable `fix/*` candidate and canonical CI/Preview. Existing Production v0.17.4 stays live.
- This candidate alone cannot ensure an already-running offline v0.17.4 PWA stops syncing; verify service-worker update, offline synchronization and historical-data read/write before any migrations 010–015.
- #889 read-only DR remains unproved at R2 encrypted-marker/hash and isolated restore level; #903 tooling PR remains pending separate owner dev authorization. No Production data should be restored to shared Scratch.
