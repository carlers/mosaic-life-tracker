# Test/CI checkpoint — v0.50.1 photo selection regression and trusted Preview artifact recovery
Updated: 2026-11-01 Asia/Manila

- Original v0.50.1 integrated Preview `fix/dayview-swipe-integrated-v0501-20261101@f32f47f368acc66c9ee44bbda6fda8b8be9c19c0` passed full canonical [Quality Gate #41220167638](https://github.com/carlers/mosaic-life-tracker/actions/runs/41220167638) on attempt 2; on attempt 1 only an unrelated split-panel resize-paint assertion failed, while all swipe and DOM tests passed. Trusted Preview Delivery #41220838346 failed closed because the build artifact is labeled attempt 1 while canonical accepted attempt 2; no exact-SHA Vercel READY yet.
- Source changes from accepted user-tested swipe/photo Preview remain unchanged. Add a missing user-visible regression: task photo selection mode must toggle selection instead of opening the viewer while still suppressing browser-native image drag. This is a focused test-only enhancement, **no runtime or v0.50.1 version change**, not a status-only CI retry commit. Task `chatgpt/dayview-swipe-selection-regression-v0501-20261101` targets the same stable v0.50.1 Preview.
- Run task focused gate, squash into stable v0.50.1 Preview, then require fresh exact-SHA canonical (including its own matching build artifact) and Trusted Vercel READY. Recheck dev still `f01a43479baa476d4ed1c8074a430a1065af66f7` and verify promotion source/dev trees; owner approved dev merge only. Do not bypass publisher artifact verification, modify auth/backend or Production.

---

# Task checkpoint — Accepted Day View one-day momentum and photo drag, v0.50.1 forward-port for authorized dev merge
Updated: 2026-11-01 Asia/Manila

- Owner accepted original `fix/dayview-single-day-snap-photo-v0447-20261031@73692710122bd47b1ff5b0e28a6e963465701a7e` after physical mobile use; its full canonical #41216695153 and trusted Preview deployment passed. Owner expressly requested a `dev` promotion plus remaining-work review; no `main` or Production approval.
- `dev` advanced to v0.49.0 with Day View settings/sorting and Uncompleted task search, then documentation-only #1501, then Storage v0.50.0 via PR #1505 to `dev@f01a43479baa476d4ed1c8074a430a1065af66f7`. No intervening change touches `src/components/home/views/DayViewSheet.tsx`, `TaskItem.tsx`, the accepted gesture/image regression files, or their tests. The previous v0.49.1 integration `fix/dayview-swipe-integrated-current-v0491-20261101@665d931b979b6627dc40a5d6ead8179a7d666198` passed full canonical #41219378958, but became stale on new dev/version before promotion; do not merge it.
- New task `chatgpt/dayview-swipe-forward-v0501-20261101`, stable `fix/dayview-swipe-integrated-v0501-20261101` from exact latest dev v0.50.0. Reapply the **same accepted app/test blobs** from the successfully integrated v0.49.1 candidate with unchanged functionality; update only three version metadata files to v0.50.1 and this checkpoint on current dev. Preserve Storage page/services, new documentation/Vercel Sandbox rule, Day View settings/Timeline Completed first/last, search and cross-device behavior.
- User-facing fix: Swiper FreeMode finger tracking and velocity-responsive one-day-capped snap from release/cancel, stale Swiper pointer ID cleanup, parent date reconciliation and held-drag protection; disable HTML native task photo dragging, retain click and selection. Browser gesture, DOM photo and test mock regression coverage unchanged.
- Require focused+browser Quality Gate, squash to current-dev-derived stable Preview, canonical/size and exact-SHA trusted Scratch Vercel READY, check dev drift and PR promotion provenance/identical tree, then merge to dev under existing owner approval. No Production. Remaining work review is read-only; #858 ongoing performance, #1008 WebKit, #855 older unverified distant-date issue, #856 continuous drag issue historical status, and integrated real-device checks.

---

# Task checkpoint — #1476 approved v0.50.0 Storage promotion, docs-only dev drift
Updated: 2026-10-31 Asia/Manila

- Owner accepted Phase 1 and authorized dev merge, then Phase 2 #1477. No main/Production authorization.
- Accepted v0.50.0 Storage Preview `feature/1476-storage-integrated-v0500-20261031@971eeb2d92ceedfa733a72691368f2f8dcc76f77` passed full Quality Gate #41218156275, Trusted Preview Delivery and exact-SHA Scratch Vercel READY. Owner accepted functionality originally at v0.48.0; version reallocated after dev reached v0.49.0.
- Promotion PR #1502 passed preflight but dev advanced to `7ac1a99427750a95c1d9c3da0593f72c650214e4` (documentation-only workflow #1501). GitHub refused merge with SESSION_STATE conflict. New task `chatgpt/1476-storage-doc-reconcile-v0500-20261031` forward-ports the **same accepted v0.50.0 app source and version**, preserving latest dev AGENTS/workflow/Scratch instructions and this checkpoint. Stable `feature/1476-storage-final-v0500-20261031` must pass focused/canonical/Preview before dev promotion.
- Phase 2 #1477 to follow successful dev promotion; owner-scoped read-only media metadata only, never cloud deletion or fabricated account quotas.

---

# Task checkpoint — Vercel Sandbox operational path for #1461
Updated: 2026-10-31 Asia/Manila

- User requested a permanent rule: try Vercel Sandbox before requesting manual terminal execution. Existing official Vercel project Sandbox history from October 22/31 and a newly created disposable Sandbox confirm shell access and exact-SHA Git checkout are available in this connected Chat.
- New Sandbox `mosaic-1461-scratch-ops-probe-20261031` executed Git/Bash/Node at `/vercel/mosaic-life-tracker`; checkout `faae41b5bf93e72f4c9b6f8ec75bef720966c4b8` clean; Frankfurt Scratch endpoint reachable without authentication (HTTP 401).
- No `APPWRITE_API_KEY` inherited in Sandbox. Shell works; Scratch migration 016, Function deployment, historical scrub and two-account privacy acceptance remain blocked by lack of an authorized Scratch-scoped administrative credential. No Scratch/Production mutation.
- Documented rule in `AGENTS.md`, `AI_WORKFLOW.md` and `SCRATCH_PREVIEW_WORKFLOW.md`; version impact NONE. Do not promote #1461 Preview feature to dev or Production as part of docs-only workflow update.

---

# Task checkpoint — #951 Day View v0.49.0 integrated promotion candidate
Updated: 2026-10-31 Asia/Manila

- Owner explicitly approved merging the accepted Day View settings + Timeline Completed-last Preview to `dev`; `main`/Production remain unapproved. Original accepted Preview `feature/951-dayview-settings-sort-v0490-20261031@9f3080cbb40c475c49ef6c080f448f14f4d12d64` has canonical #41212463460 SUCCESS and matching Scratch Vercel READY.
- Original Preview diverged because `dev` advanced to `215bbe86b39ea779120d2882a6086e0756f55d5c` v0.47.1 with #1473 Uncompleted Tasks search and earlier #1466 Home search pagination. GitHub comparison verifies these additions touch only Uncompleted Tasks source/tests, three version files and this checkpoint, not any Day View/Settings implementation files. Preserve both completed features exactly.
- Forward port original accepted source/test blobs unchanged to current `dev`; preserve its whole checkpoint below, carry accepted v0.49.0 in the three version files without bump, and create `chatgpt/951-dayview-settings-forward-v0490-20261031` → `feature/951-dayview-settings-integrated-v0490-20261031`. Source includes the direct Day View gear/route, restored selected date, related Tasks & Calendar navigation, Timeline Completed last + Newest/Oldest and prior Completed first/mobile header regressions.
- Required steps: task focused CI; squash into integrated stable Preview; exact-SHA canonical checks and Vercel Scratch READY; verify dev has not moved again; then owner-authorized stable Preview → dev PR merge preserving identical tree. Do not merge stale original Preview or skip gates; device/manual checks remain unverified.

---

# Task checkpoint — #1473 Uncompleted Task search v0.47.1 integrated Preview candidate
Updated: 2026-10-31 Asia/Manila

- Owner accepted user-visible v0.47.0 Uncompleted Task search Preview from issue #1473 and requested removal of the white separator directly beneath the expanded search input followed by promotion to `dev` (explicit promotion approval only for this feature; no `main` or Production approval).
- New `dev@343b857fa43d26e7afc7b7f6de81ac479416bba2` is v0.45.0 including #1466 Home task search pagination. To preserve that completed work, forward-port the accepted #1473 v0.47.0 source and existing focused regressions onto current dev and remove **only** the expanded Uncompleted Search container `border-b border-border` classes. The input's own border, existing header divider, groups, owner privacy, task operations and app behavior remain unchanged.
- Revision uses v0.47.1 PATCH after first successfully delivered v0.47.0 Preview. Task branch `chatgpt/1473-search-divider-forward-v0471-20261031`; new stable Preview `feature/1473-uncompleted-search-v0471-20261031`. The source page, helper and both existing test files come from accepted #1473 Preview; version and all other files come from latest dev. No backend/schema/sync change.
- Run focused checks, squash task PR into new stable Preview, full canonical build/size/browser CI and trusted Vercel Scratch READY. Verify branch/version drift and exact source tree before explicit accepted Preview → `dev` merge; if dev advanced again, reconcile into a fresh integrated Preview and reverify before merge. Required real device/login acceptance remains unverified until performed; no Production modification.

---

# Task checkpoint — #1466 Home task search incremental results v0.45.0
Updated: 2026-10-31 Asia/Manila

- Authorized implementation of Home Search `Load more tasks` in 50-result increments. Source baseline: `dev@4aec8d63ef460cbc56a8f895f0f609a2152ea459` (v0.44.4). Task branch: `chatgpt/home-task-search-load-more-v0450-20261031`; target stable Preview: `feature/1466-home-search-load-more-v0450-20261031`.
- Scope: change only the lazy Home Search results window; preserve local RxDB owner-only input, ranked search, filters and Day View/Backlogs navigation. Initial 50 matches; Load more appends 50; reset window when query/filters change or search clears/closes. Preserve scroll offset on append. No Appwrite, migration, dependency or Production change.
- Files: `src/components/home/HomeTaskSearchExpanded.tsx`, existing DOM/unit search regressions, three version files, this checkpoint and §2 search contract. Candidate Preview version `0.45.0`.
- Delivery: commit one coherent task tree with `[verify:focused]`, inspect focused CI; only after green squash via PR to stable Preview, then verify exact-SHA canonical CI, size/PWA and official Scratch Vercel READY. Manual phone scroll/focus acceptance remains separate. No approval to promote to `dev` or `main` or modify Production. Issue #1466 remains open until delivery acceptance.

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
