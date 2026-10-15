# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #861 — detailed Sync Now local reconciliation progress (v0.24.4).

## Verified baseline
- User accepted both Chat Sync and normal Sync Now on v0.24.3 Scratch Preview. PR #848 merged to `dev@1fe08f987b4c6e78d0f2bb6716d7472dd87bb4c3` (source tree matches stable `edf05017`); postmerge Quality Gate #38661881984 SUCCESS and Vercel `dpl_AzM3upSfTo7LQ5a3faQvYaRV7Rvt` READY. Main/Production untouched. #708 and #526 own remaining reliability/workflow concerns.
- In Settings → Sync Status, `refreshSync({reconcile:true})` awaits eight parallel pilot freshness checks then eight sequential `syncCollection` authoritative scans before a final eight-pilot freshness barrier. Old indicator reaches 100% after the first barrier, then shows generic “Verifying local data…” throughout the long scan. No evidence yet that the scan is logically stuck; user requested granular progress.

## Approved scope
- #861 isolated UI/instrumentation only: show active verification group, completed groups, real pages/server rows and local-row counts. Count actual completed initial-refresh + verify + final-refresh barriers in a monotonic 24-step overall percentage for Sync Now, leaving plain refresh at eight steps. No fabricated per-row percentage when the remote total is unknown.
- Retain all existing reconciliation, safety, account-scoped status, timeouts/backoff and failure behavior; no Appwrite Function, schema, data or Production changes. PATCH candidate 0.24.4. Task branch `chatgpt/861-sync-verification-progress-20261015` based on the accepted dev source.

## Next action
- Finish unit/DOM regression verification and focused CI, squash to a new stable fix Preview after focused green, then require full canonical + Vercel READY and user manual acceptance before any dev promotion. Keep #861 open pending acceptance.
