# Session checkpoint

Updated: 2026-09-27

Current task: restore Mosaic's local-first startup behavior and make an authenticated device fully useful offline after online hydration, while improving Login/Home initial mounting and adding compact Home connectivity/sync indicators.

Status: implementation active on `chatgpt/offline-startup`, targeting stable Preview `perf/offline-startup` created from accepted `dev` commit `102ef432d591907832e1833236323fc218ab8e7c`.

## Working set
- bootstrap/auth/database/sync ownership: `main.tsx`, `AuthProvider.tsx`, `AppLayout.tsx`, database/sync bootstrap modules
- offline readiness/service-worker lifecycle and shared sync status
- Home status indicators beside Search
- own-profile/friend-calendar cache correctness
- offline task-image staging/upload reconciliation
- startup/offline unit, DOM, production-browser regressions
- `docs/PROJECT_REFERENCE.md`

## Completed substeps
- Promoted accepted Backup & Restore Preview to `dev`; dev Quality Gate run 977 passed and the matching deployment is READY.
- Created stable `perf/offline-startup` from exact dev tip and the `chatgpt/offline-startup` working branch.
- Audited current startup graph and corrected the authoritative spec before implementation.
- Identified blocking startup order (storage persistence + full RxDB before React), duplicate cold-start auth work (AuthProvider + bootstrap sync), delayed cached-auth offline hydration, and missing explicit offline-readiness semantics.
- Identified non-RxDB gaps: own profile remote-only load, friend cache stale/offline + owner-isolation issue, and task image upload requiring live Appwrite.
- Defined Home connectivity/sync UI as a view over one coherent shared status model.

## Remaining substeps
- Add lightweight dynamic database bootstrap/readiness gate and mount React/Login immediately.
- Make AuthProvider offline-cache-first when definitely offline; add auth generation/race protection; make sync identity explicit.
- Add offline data/shell readiness milestones and startup diagnostics.
- Cache own profile per owner; owner-scope friend caches and allow stale friend calendar while offline.
- Add durable pending task-image storage and sync-time upload/rewrite.
- Add Home connectivity + sync status controls and Sync Status access.
- Add/repair focused regressions, then exact-SHA full canonical acceptance.
- Squash-deliver into `perf/offline-startup`, verify Vercel Preview, and hand off installed-device offline relaunch checks.

## Constraints
- Preserve account isolation, confirmed-401 semantics, tombstones, local-first writes, sync mappings, and existing PWA prompt/update policy.
- Login must not depend on RxDB; protected data providers must not mount before local DB readiness.
- Sync must not call `account.get()`; AuthProvider is the sole session owner.
- Normal online navigation must not wait for first sync just to claim offline readiness.
- No promotion from `perf/offline-startup` to `dev` without explicit user instruction.

## Verification
- Baseline `dev`: `102ef432d591907832e1833236323fc218ab8e7c`, Quality Gate run 977 green.
- New implementation verification: pending.
- Manual installed-PWA offline relaunch: pending.

Next action: land spec-first startup/auth/database regressions, then implement the lightweight bootstrap boundary.

Blockers: none.
