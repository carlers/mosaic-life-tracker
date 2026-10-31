# Task checkpoint — #1441 Chrono grammar benchmark follow-up
Updated: 2026-10-31 Asia/Manila

- Research task branch based on accepted benchmark Preview feature/1441-command-model-benchmark-20261031@e5a65c3bc3f9ccaf8dc71af1b27e31d00cbaa3c2. Current dev separately advanced to 343b857fa43d26e7afc7b7f6de81ac479416bba2; no promotion or overwrite.
- Add JS grammar plus optional pinned Chrono to existing isolated 168-case benchmark and independent 30-case challenge set. No changes to shipped Mosaic, Appwrite, schema or PWA. Version impact NONE.
- Local Node baseline: 7 tests passed, known corpus 168/168 exact with zero unsafe (tuned, not independent); holdout 16/30 with one unsafe create. These are not Android timings or production safety evidence. First Chrono run failed at a non-exported package.json import (before any Chrono inference), and npm pulled the parent package dependency graph; repaired to install only Chrono in RUNNER_TEMP, symlink the single library, and verify ESM import. Rerun pending.
- Request focused task CI plus isolated workflow; stable Preview canonical CI/Vercel delivery only after focused green. Keep issue #1441 open; never promote to dev/main/Production without explicit approval.

---

# Task checkpoint — #1441 independent command-model benchmark
Updated: 2026-10-31 Asia/Manila

- Baseline: dev@4aec8d63ef460cbc56a8f895f0f609a2152ea459 v0.44.4. Research-only deliverable, refs #1441, with 168 synthetic commands, 48-case stratified model comparison, source tests and independent model download workflow.
- New harness: benchmarks/command-models/{make_dataset.py,benchmark.py,test_benchmark.py,README.md}; GitHub Actions task-branch matrix only. No app dependencies or production user data, model inference opt-in in CI.
- Local baseline (unpublished test platform): rules parsed 109/168 exactly (64.88%) and had 2 unsafe false actions; balanced sample 32/48 (66.67%) and 0 unsafe. Five Python unit contracts passed. Actual model scores pending GitHub network runner.
- Version impact NONE. Inspect task branch [verify:focused], model benchmark workflow logs and JSON artifacts, then prepare stable Preview canonical as allowed by repo workflow. Never promote to dev/main or modify Production without approval.

---

# Task checkpoint — #1443 Preferences replication integrated v0.44.4
Updated: 2026-10-31 Asia/Manila

- User expressly authorized merging the accepted preferences-sync repair to `dev`; current integration baseline is `dev@43d40603fa5e59c0d3a1bd1363ab69a3aefff6ff` v0.44.3 with both #1386 page swipe and cold-start work. Old v0.44.1 isolated Preview cannot promote over newer versions.
- First v0.44.4 candidate from v0.44.2 at `fix/1443-preferences-sync-v0444-20261031@fe22206390770dd9a791e84a5cb47ecd831cc0c3` passed full canonical on retry (browser drag test was intermittently red), but publisher found no attempt-2-matching artifact, and concurrent v0.44.3 promotion advanced dev. That candidate was not delivered/promoted.
- Current forward-port task `chatgpt/1443-sync-forward-0443-v0444-20261031` and stable Preview `fix/1443-preferences-sync-v0444-integrated-20261031` apply the **same unchanged five preference source/test blobs** on latest dev v0.44.3. Assign v0.44.4 as the next available patch without modifying swipe performance behavior. Run focused verification, squash into stable Preview, full canonical CI and trusted Vercel Scratch READY. Then merge only this accepted source into `dev` per owner approval, checking dev head drift again. No main or Production mutation.
- Core fix: migrate legacy oversized-ID preference values to valid owner/key IDs before local cleanup and skip only impossible-remote oversized physical-deletion RxDB queue entries. Valid-ID deletion remains tombstone-only; preserve user isolation. Real production-device sync acceptance remains pending; leave #1443 open.

---

# Task checkpoint — #1386 cold first-swipe preparation (Phase 1+2)
Updated: 2026-10-31 Asia/Manila

- The user-approved v0.44.2 prepared-page forward-port was merged to protected `dev@a9f1650f9b262705413b64e3d5b2288b53620e83` via PR #1449 after stable Preview #1448, exact-SHA canonical, Vercel READY and unchanged-tree merge. Production/main unchanged.
- Next candidate v0.44.3 branches from that dev merge. It shares the returning-Home initial preload with the route's prepared component cache instead of a disconnected module import, and schedules neighbor code after Home local data readiness and next paint. Non-Home neighbor preloads advance to the next post-paint frame; messages keep their earlier immediate warmup.
- The new one-shot startup readiness listener is cancellation-safe and side-effect free for synced data. Optional Home neighbor module-readiness marks are included in the synthetic mobile audit; **no physical-device or authenticated-PWA timing is claimed**. Full installed PWA swipe/content settle audit still needed.
- Tests exercise Home first render, mark subscriptions (early, late, canceled, failure isolation), and existing route/gesture contracts. No data/provider/backend/Production changes. New v0.44.3 user-testable refinement requires task focused CI then fresh stable Preview canonical/size/Vercel; no automatic dev/main promotion for this iteration.
- Outstanding cross-workstream: #1443 preferences sync Preview reserves v0.44.1, and may need version reconciliation after v0.44.2 dev promotion.

---

# Task checkpoint — #1386 swipe first-frame / Settings compatibility
Updated: 2026-10-31 Asia/Manila

- User authorized promotion of previously accepted v0.43.9 swipe Preview to dev, followed by cold-start work. At request time dev had already received unrelated v0.44.0 Settings/Me reorganization (dev `efeec22df14b4cb9d8dc1ffa3d5852e7af4a1775`). The old v0.43.9 tree diverged, was lower-versioned and omitted new Settings routes; exact older-tree promotion is unsafe.
- This v0.44.2 forward-port starts from current dev, retains all v0.44.0 Settings routes, and carries the previously accepted prepared route module caching to actual routes and swipe previews. Reuses each Settings/Preferences page with its original pathname-aware preview props. Adds deferred Settings child module warmup and focused regression.
- v0.44.1 is separately reserved by #1443 preferences sync Preview. Do not alter or promote that work in this task.
- New task `chatgpt/1386-swipe-forward-port-v0442-20261031`, target stable `perf/1386-swipe-forward-port-v0442-20261031`; run focused CI, squash task into stable Preview, verify full canonical and exact Vercel READY, and only then request approved dev PR merge. No main or Production promotion.
- Next cold-start refinement (Phase 1+2) should branch from the promoted dev source after verifying branch head; measure cold first-swipe vs warm and consolidate duplicate Home preload module identity, without blanket eager page mounts or data side effects. Maintain navigation/back/gesture/reduced motion and account isolation.

---

# Session checkpoint
Updated: 2026-10-27 Asia/Manila
Current task: #1384 Settings and Me reorganization, full Preview acceptance repair; task branch `chatgpt/1384-preview-preload-registry-fix-20261027`, based on stable Preview `feature/1384-settings-information-architecture-preview-20261027@4a8eb1dc7b1143cf29b7cca18a1ea1c447507859`.

## Objective, scope and constraints
Owner approved Settings categories, search, Me tap-navigation with **no visual change to Me**, and legacy placeholder cleanup. Frontend only, v0.44.0 Preview. No `dev`/`main`/Production promotion or provider/backend/data edits approved.

## Accepted task checkpoint
- Task PR #1392 squash merged into protected stable Preview SHA `4a8eb1dc7b1143cf29b7cca18a1ea1c447507859`. Final task focused Quality Gate #40506056120 passed. Earlier #40504980671 and #40505469873 passed. Current code includes Account, Data & Sync, About Mosaic, five categorized Preferences pages, local index for individual preferences and Notifications, source-compatible Settings route-preview destination rendering and unchanged Me classes.
- Stable canonical Quality Gate #40506296566 failed the `build` job at TypeScript `TS2740` because `src/components/layout/primaryRoutePreload.ts` mapped old preview-supported routes only and lacked all eight new supported Settings/Preferences child paths. Stable DOM and dependency-audit jobs passed; browser tests in progress at diagnosis. No successful build/deployment should be inferred from source merge.

## Repair and next action
- Add exactly the eight route preload entries to existing module importers, preserving lazy bounded warm-loading and exhaustive `PreloadPath` type contract. No other runtime design changes.
- Run focused verification on coherent repair task commit; squash into existing stable Preview only after green; require new stable exact-SHA full canonical CI, production size budget, official Scratch Vercel READY, and relevant browser/device checks. Keep issue #1384 open and request separate approval before any promotion to `dev` or `main`.
- Do not weaken typing, size ceilings, security, sync, or release gates.
