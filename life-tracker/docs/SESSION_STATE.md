# Session checkpoint

Updated: 2026-09-27

Current task: make Mosaic startup local-first and make an already-hydrated authenticated device useful offline, with explicit Home connectivity/sync/readiness feedback.

Status: implementation complete on `chatgpt/offline-startup`; final replacement full canonical acceptance requested by this commit after fixing all findings from the first two full-gate attempts. Delivery target remains stable Preview `perf/offline-startup`, created from accepted `dev` commit `102ef432d591907832e1833236323fc218ab8e7c`.

## Completed
- Login/protected startup graph split: React/Login can paint before RxDB; protected providers mount only after one shared dynamic local-database readiness boundary.
- AuthProvider is the sole session owner. Definite-offline cached identity hydrates without a doomed session request, confirmed 401 still clears identity, and generation guards prevent stale auth results from overwriting newer login/logout/reconnect state.
- Sync now receives the authenticated owner explicitly, keeps per-owner status/backoff state, marks data readiness only after a complete successful cycle, and no longer performs its own `account.get()`.
- Service-worker lifecycle records a separate shell-ready milestone; Mosaic reports offline-ready only when both account data and the app shell are ready.
- Home shows compact connectivity and sync/readiness controls beside Search. Both open the shared Sync Status surface; offline state cannot present an active syncing indicator.
- Own social-profile cache is owner-scoped. Friend-calendar cache is owner+friend scoped, migrates away the unsafe legacy key shape, and may serve stale cached data while offline.
- Offline-selected task/profile images are compressed and stored in a dedicated owner-scoped pending-image store, render locally, are backed up with photos, and are uploaded/re-written before any synced row can carry a local-only image id.
- Clear Local Data / Delete All User Data clear auxiliary offline caches and pending images as well as RxDB. Network-only profile/username operations remain explicitly online-only.
- Production PWA build policy still requires `index.html` and every emitted JS/CSS chunk in the service-worker precache.
- Added/updated regression coverage for offline cached auth, auth races, DB bootstrap, owner-isolated caches/status, two-part readiness, pending-image reconciliation, Home status controls, service-worker readiness, and browser local task persistence with Appwrite unavailable.
- Focused Quality Gate run `36302632783` passed before the first full acceptance.
- Full run `36302706088` correctly blocked delivery on an unused import/build error, React 19 ref-lint violation, outdated Sync Status DOM fixture, and an ambiguous browser locator. Those root causes were fixed and focused run `36302908822` passed.
- Replacement full run `36302982690` then exposed two test-harness issues: a dynamic-import assertion ran before the mocked DB module resolved, and the PostHog auth test accidentally opened real IndexedDB. Both harness issues were fixed without changing product behavior; focused repair run `36303063280` passed.

## Constraints
- Preserve account isolation, confirmed-401 semantics, tombstones, local-first personal-data writes, sync mappings, and existing explicit PWA update activation.
- Cached identity grants access only to the same account's already-local data; it is not proof of a live remote session.
- Normal online use never waits for the first sync merely to render; readiness is informational and non-blocking.
- No promotion from `perf/offline-startup` to `dev` without explicit user instruction.

## Verification
- Baseline `dev`: `102ef432d591907832e1833236323fc218ab8e7c`, prior Quality Gate run 977 green.
- Focused implementation verification: runs `36302632783`, `36302908822`, and `36303063280` green.
- Full runs `36302706088` and `36302982690`: failed, investigated, and fixed; no failure was waived.
- Final replacement exact task-SHA full canonical acceptance: pending this commit.
- Stable Preview Quality Gate + Vercel deployment: pending squash delivery.
- Manual installed Android/Samsung PWA network-disabled relaunch: pending.
- Safari/iOS installed-PWA lifecycle check: pending.

Next action: follow this exact SHA through full canonical acceptance; if green, squash PR #94 into `perf/offline-startup`, then verify the stable branch Quality Gate and Vercel Preview.

Blockers: none.
