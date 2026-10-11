# Session checkpoint

Updated: 2026-10-11
Current task: #405 approved Bucket List linked tasks v0.19.0; original v0.18.0 user-tested.

## Scope and branches
- Stable Preview branch `feature/bucket-list-405` at `c16a32c2` after PR #627 (feature) and #629 (TS/React/sync tests repair). `dev/main` unchanged v0.17.4.
- Owner-only private `bucket_task_links` references between an aspiration and real canonical tasks: original category, date/Backlog, ordering, visibility/sharing, completion remain untouched. Goal detail + editorial list, reverse task Action Sheet linker, existing task picker, create and link with retry-safe local ID, eighth RxDB pilot/owner CAS, additive Appwrite migration 011, v4 portable backup/restore (cross-account task+goal remapping, old v1–v3 compatibility), account erasure and GC. No Scratch migration/Function activation yet. Current combined Scratch `message-action@6acba22560abbd99d124` must not be overwritten blindly.

## Verification
- Task [focused 38153120083](https://github.com/carlers/mosaic-life-tracker/actions/runs/38153120083) SUCCESS, feature PR #627 and repair PR #629 squash-merged only to stable.
- Second canonical stable [38153182947](https://github.com/carlers/mosaic-life-tracker/actions/runs/38153182947): TypeScript, lint, DOM, browser contracts, dependency checks pass. One unit route-registry expected literal actual sample path, corrected on budget repair branch.
- Measured v0.19.0 build-size guard at same SHA: GitHub entry raw 444801/gzip 132313, initial 145423, Home 364073, total raw 2440618/gzip 755850, precache 2527425. Exact GIPHY-enabled [Vercel dpl_BMzc9SJf11QerUkB3JvFQFcLNbqe](https://vercel.com/carls-projects-72516fde/mosaic-life-tracker/BMzc9SJf11QerUkB3JvFQFcLNbqe) measured entry raw 444965/gzip 132414, initial 145524, Home 364213, raw 2442832/gzip 756853, precache 2529639; provider ERROR only from existing size guard. No other build errors. `chatgpt/bucket-list-v019-size-review-405-20261011` records seven metric-specific ceilings, old limits, issue and exact provider evidence; no baseline or enforcement changes.
- Run focused repair check, squash to stable Preview, then full canonical + exact Vercel READY. Keep v0.19.0 version unchanged. No dev/main/Production mutations.

## Next action
After green stable CI and Vercel, coordinate approved **separate** Scratch additive migration 011 + reviewed combined Function activation under shared #526 writer lock; current existing Scratch app stays safe until rollout. Then authenticated disposable-account multi-device/offline/privacy/restore task/category tests and user acceptance. No dev/main promotion until user approves.
