# Task checkpoint — #857 Appwrite date-effective Retire/Restore v0.56.0

- Reconciled from old v0.53.0 task source `38cfe3b549b76c94d81a409e9229c841879201d2` onto exact newer dev `029b5cb758e1180b595c9b3f6c3822eb3a995675` v0.54.0 (feature-controls, no overlapping feature files), resolving v0.55.0 reservation and preserving all accepted dev changes.
- Owner accepted v0.51.2 P0 on Scratch and requested completing category lifecycle. Phase A is on dev, not main/Production.
- Non-destructive date-effective Retire/Restore source: categories RxDB v2, Appwrite additive `retired_on` migration 016 and owner-CAS allowlist, Day View/Backlogs/Timeline historic projection, guard new assignments while allowing edits to existing tasks and friend-calendar parity.
- Old isolated source focused #41230316530 SUCCESS. Must run fresh focused gate on reconciled exact task SHA, stable canonical gate, Scratch signed Preview, and Vercel READY; no dev/main/Production promotion without separate owner acceptance.
- Scratch target `6a96e82d000d1310b3be` has optional `categories.retired_on` available; inactive Function deployment `6ae635955eb56c6c1818` from exact unchanged function sources, not activated pending ready check.
- Follow-up #857 Move+Delete and Delete All remain blocked behind server-authoritative concurrent-write/old-PWA guard, dependency cleanup, and owner-fenced transaction evidence.

---

# Task checkpoint — #1026 Feature Controls dev reconciliation v0.54.0
Updated: 2026-11-01 Asia/Manila

- Owner accepted six operational switches on real Preview (confirmed prompt-controlled toggle changes instantly) and explicitly authorized integration into `dev`; no approval to change `main`, Production or backend.
- Source accepted: `feature/1026-feature-controls-v0460-20261031@894e5e4c6e07063841a27c0e56e9439708eb31dc`, canonical `41198033073` passed, trusted prebuilt Preview READY on Vercel. Six PostHog disable flags created as inactive in project 619969, with full-target release conditions. All remote flags remain unchanged.
- This task forward-ports the same P0 behavior from v0.46.0 onto newer `dev@606f97347ca435247e9bacc4e76a26e2c5d3c78a` v0.51.2, preserving intervening Home search, storage, Day View, and category deletion improvements. Independent Preview candidates v0.52.0 and v0.53.0 were reserved at preflight; use noncolliding v0.54.0.
- Changes: typed flag registry/hook, six read-only/offline-aware operational boundaries, PostHog stable refresh semantics, focused tests and operator documentation. Tests and CI must be run on the reconciled tree; do not reuse old v0.46.0 acceptance as evidence for v0.54.0. Existing queued uploads and media remain intact.
- Delivery: focused CI on task branch, squash to stable Preview, exact-SHA full canonical, Scratch Preview READY, read-only promotion preflight, approved dev PR. No changes to `main`, Production or PostHog remote flag states.
- Remaining after promotion: new priority P1 registry phase. Plan isolated optional capabilities (import, Timeline, Bucket List, discovery etc.) with data-preservation and background-operation boundaries before expanding the registry.

---

# Task checkpoint — #1186 P0 category deletion containment and orphan inventory, v0.51.2

- Base protected dev @ 27f78f9c51ca1aa8d37240e2eb454907dbc245d3, v0.51.1; main remains v0.50.3. Current task branch `chatgpt/1186-category-delete-containment-v0512-20261101`.
- Owner authorized first P0 containment phase after #857 lifecycle hardening, not the retirement schema or destructive backend cascade.
- All category deletion paths in current category hook/UI blocked, including `updateCategory(isDeleted:true)`; old installed PWAs may still bypass this current-client barrier. No backend or data writes.
- Owner-only, read-only inventory of tasks whose category is no longer active, across dated tasks and Backlogs, paged within Category Manager. No automatic migration/recovery.
- Focused tests target deletion guard, owner isolation, orphan filtering, and UI. Run focused CI and stable exact-SHA canonical Preview; Appwrite Scratch readiness required only for backend-dependent steps. No dev/main/Production promotion without separate approval.
- Follow-up #857: date-effective Retire/Restore, then explicitly chosen Move+Delete, then server-guarded Delete All. See #857 hardened critique. Verify old-PWA guards before claiming global deletion safety.

---

# Task checkpoint — #1477 accepted cloud inventory privacy patch v0.51.1 forward-port to dev v0.50.3
Updated: 2026-11-01 Asia/Manila

- Owner explicitly approved merging Storage Phase 2 PATCH v0.51.1 to dev and asked to continue remaining nondestructive work. Not authorized: main/Production promotion, server mutations, phase 3 destructive deletion.
- Accepted stable Preview `feature/1477-cloud-inventory-cancellation-v0511-20261101@806ddac6f73d5c63e0ce181dd6f945ec12d92ca1` passed canonical #41223168862 and Trusted Preview Delivery #41223454814; exact-SHA Vercel deployment dpl_DDruZsE1TU3iQ1NpfAnzMF5bo6h2 READY.
- Current dev `45b529a99b3bd7fe88223d4b3108f1a7e0ee96a1` v0.50.3 includes accepted one-day swipe/photo-drag improvements, in addition to Calendar scroll v0.50.2. Integrate only accepted owner-referenced cloud inventory/read-only UI/tests/docs and v0.51.1, preserving the newer Day View source and regressions. Task `chatgpt/1477-cloud-storage-dev-forward-v0511-20261101`, stable Preview `feature/1477-cloud-storage-dev-integrated-v0511-20261101`. Run task focused, stable canonical/size/browser, trusted Vercel Scratch READY, promotion PR preflight and nondivergent approved dev PR.
- Original v0.51.0 promotion PR #1515 is superseded; never merge older candidate over this privacy patch.
- Remaining Phase 2 work: read-only three-account Scratch permission denial, account switch and offline testing without live user data; no exhaustive storage/orphan claims until separately authorized server-owned index. #1478 deletion remains deferred.

---

# Task checkpoint — Day View one-day swipe momentum and photo drag, v0.50.3 reconciled dev promotion
Updated: 2026-11-01 Asia/Manila

- Owner accepted physical feel of original stable `fix/dayview-single-day-snap-photo-v0447-20261031@73692710122bd47b1ff5b0e28a6e963465701a7e`, explicitly approved merging to `dev`, and requested remaining-work audit. No `main` or Production approval. Original canonical #41216695153, exact-SHA trusted Vercel READY; integrated v0.49.1 canonical #41219378958 passed; integrated v0.50.1 canonical #41220167638 succeeded on attempt 2, including all browser shards (initial unrelated split-panel resize intermittent failure).
- Live `dev@afdca35ac2f0287b04a24f19af21a73d4a1b9838` has since gained accepted v0.50.2 Calendar scroll fix #1510, on top of Storage v0.50.0, Day View settings/sorting and search. Previous stable `fix/dayview-swipe-integrated-v0501-20261101` advanced to `86c2e2335c9abb6f2b161024ed94c0f5b3944949` through #1511 selection-mode photo test; its exact-SHA canonical #41221212354 succeeded. Do not merge stale Preview with version regression; preserve Calendar's source and new scroll test in `interaction-contract.spec.mjs`.
- Reconciliation task `chatgpt/dayview-swipe-forward-v0503-20261101` and stable `fix/dayview-swipe-integrated-v0503-20261101` derive from current dev v0.50.2. Apply only the exact accepted DayViewSheet momentum/release source blob, native photo dragging protection, Swiper FreeMode mock, current photo DOM regression (including selection-mode), and add only the single-gesture fling/partial-snap browser test to dev's existing interaction contract. The version is v0.50.3; other source/test/docs from dev are preserved.
- Verify task focused/browser, stable exact-SHA full canonical/size/registered Scratch Vercel READY, current dev SHA, promotion tree parity and configured repo preflight. Then owner-approved Preview→dev PR, checking dev checks and deployment. No backend or Production writes.
- Follow-up audit (read only): no confirmed new Day View momentum defect; device-level tests, #1008 WebKit browser lane, #858 performance diagnostics and #855 older distant-date repro remain separate unverified/ongoing work.

---

# Task checkpoint — #1388 Calendar scroll v0.50.2 integrated candidate
Updated: 2026-11-01 Asia/Manila

- Owner confirmed v0.43.13 live DevTools viewport-cap test restored Calendar scrolling, then authorized merging Calendar fix to `dev`. No main/Production approval.
- Original accepted Preview `fix/calendar-long-grid-scroll-20261027@080959b4c7ff7c38fa993893523ed1f828c1eeda` passed canonical Quality Gate #41186816066 attempt 3 and exact-SHA Vercel READY. It is version 0.43.13. Direct promotion would regress version from latest dev 0.50.0.
- Integrated task `chatgpt/1388-calendar-scroll-forward-v0502-20261101` and stable Preview `fix/1388-calendar-scroll-integrated-v0502-20261101` begin from exact dev `f01a43479baa476d4ed1c8074a430a1065af66f7`. Apply only the accepted Calendar-related frontend changes and browser regressions, leaving all other dev features and docs intact. New version **0.50.2** (0.50.1 reserved by active dayview Preview).
- Required: task focused+browser CI, squash PR into stable integration Preview, full canonical Quality Gate, exact SHA Vercel READY, GitHub/Vercel read-only promotion preflight, then approved stable Preview → dev PR (only if dev HEAD still matches safe base; reconcile drift otherwise). No main/Production promotion, backend data migration, CI bypass or user-account changes.
- Outstanding manual: hosted v0.50.2 Preview parity with owner-confirmed DevTools fix and phone view may still need separate verification; user approved dev merge after successful live-page clamp and accepted previous Preview.

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
