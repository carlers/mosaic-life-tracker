# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #526/#889 isolated historical-client compatibility and pre-1.0 Production-readiness preparation; owner is manually testing dev.

## Verified state
- Protected dev `3f225ae64a021c947a77d4528d25afb3f305f17f` v0.29.1 READY / Quality Gate #38715612416 SUCCESS. Main Production `bb58300052dc4c85974d97779e2b257ec4f28c7d` v0.17.4. Diverged histories; Production backend/readiness not approved.
- #592 CI-first default on dev works; bounded closure review recorded, but authenticated/alias and rollback follow-ups remain unverified.
- Read-only Appwrite Product/Scratch drift: missing Prod Bucket List tables 010/011; Diary optional emoji/photos 012/013; Diary reactions table 014; four messages diary refs 015. Production old client mapper passes unknown columns into strict RxDB. Function union and encrypted DR completed-marker/restore are unverified.
- #526 original isolated full-green read/write checker was on `refactor/526-production-compatibility-20261015@d78bc715f81b9e63f123d09fa7059d7f47f317d2` based on old dev. This task rebases tooling (not runtime/schema) on current dev.

## Isolated scope
- Checker accepts explicit reviewed `--table` selection for genuinely existing historical client subscriptions, while default remains all eight and fail-closed; prints excluded collections as UNASSESSED. Tests prove new table false-positive exclusion does not hide Diary/message unknown-field failures.
- Package script and release-readiness documentation included. Version remains v0.29.1, no Application runtime/Production/Dev/Scratch changes.

## Next action
Get focused CI green, repair tests if needed. Squash through one source-first stable refactor Preview, full exact canonical and trusted CLI READY, record #526/#889 evidence. No protected dev/main promotion absent separate owner approval. Historical PWA read/write, DR marker/restore and backend write gates remain pending.
