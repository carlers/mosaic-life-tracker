# Session checkpoint

Updated: 2026-09-27

Current task: make Mosaic startup local-first and make an already-hydrated authenticated device useful offline, with explicit Home connectivity/sync/readiness feedback.

Status: implementation complete on `chatgpt/offline-startup`; final canonical acceptance requested by this commit. Delivery target remains stable Preview `perf/offline-startup`, created from accepted `dev` commit `102ef432d591907832e1833236323fc218ab8e7c`.

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
- Focused Quality Gate run `36302632783` passed on the final runtime hardening before this checkpoint.

## Constraints
- Preserve account isolation, confirmed-401 semantics, tombstones, local-first personal-data writes, sync mappings, and existing explicit PWA update activation.
- Cached identity grants access only to the same account's already-local data; it is not proof of a live remote session.
- Normal online use never waits for the first sync merely to render; readiness is informational and non-blocking.
- No promotion from `perf/offline-startup` to `dev` without explicit user instruction.

## Verification
- Baseline `dev`: `102ef432d591907832e1833236323fc218ab8e7c`, prior Quality Gate run 977 green.
- Focused implementation verification: run `36302632783` green.
- Exact task-SHA full canonical acceptance: pending this commit.
- Stable Preview Quality Gate + Vercel deployment: pending squash delivery.
- Manual installed Android/Samsung PWA network-disabled relaunch: pending.
- Safari/iOS installed-PWA lifecycle check: pending.

Next action: wait for this exact SHA's full canonical acceptance; fix any failure, then squash PR #94 into `perf/offline-startup` and verify the stable Preview deployment.

Blockers: none.
