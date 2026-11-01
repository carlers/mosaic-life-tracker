# Current task: #1460 photo messages forward-port onto dev v0.59.0
Updated: 2026-11-01 Asia/Manila

- Owner accepted v0.46.1 chat photos/reply thumbnails and requested dev promotion. Current dev 50d5afb2cf7d04c3739a482736b815008eea1405 is v0.58.0, diverged from accepted photo Preview be23ad5e5d407a1c4fbf837e3222c3052dbe332b. Direct promotion is blocked by version regression and code conflicts.
- New v0.59.0 candidate integrates approved photo media against latest dev while retaining newer dev privacy, settings, feature controls and sync mapping. Function uses latest dev diary privacy plus photo media; no Scratch backend mutation in this integration.
- Sandbox previously verified 1,272 unit, 715 DOM and 222 Function handler tests pass, TypeScript, lint (no errors), project/version contracts and pinned historical client pass. Lazy outgoing delivery worker keeps Home gzip 380,978 / 381,000 bytes in sandbox. Must independently recheck exact reconstructed tree, canonical stable Preview and Vercel READY. The changed v0.59 tree needs new user Preview acceptance before dev.
- Main/Production unchanged. Issue: https://github.com/carlers/mosaic-life-tracker/issues/1460

---

# Task checkpoint — #1461 integrated v0.58.0 canonical Home-size repair
Updated: 2026-11-01 Asia/Manila

- Owner approved accepted v0.45.2 reversible diary quotes to dev; initial integrated v0.58.0 stable Preview `fix/1461-diary-quotes-dev-integrated-v0580-20261101@f3ee6bf24885cd0679ecd27de3ebcd5ab937f2b2` exactly matches locally tested source, but canonical #41232908236 build failed by 21 bytes at blocking Home gzip limit (381,021/381,000). Do not adjust build budgets.
- Scoped source fix: replace repeated remote-field deletions in the existing `syncMapping.ts` tasks/diary/friendships/messages mappers with equivalent loops over their known Appwrite field sets; delete only snake_case names and `deleted`, retaining local status, content, direction, reactions and all camelCase properties. This also handles future newly known server-owned snake_case columns. No backend migration or Function source change.
- In Vercel Sandbox, corrected local build passed (Home closure 380,818/381,000); affected mapping tests 61/61, full Vitest 2,176/2,176 across 325 files, changed-file ESLint, version/contracts and diff checks passed. Reverify exact GitHub task focused CI, stable full canonical with Node 22 and Vercel READY before approved dev promotion. No main/Production action. Scratch deployed Function changed independently but read-only schema and `revoke_diary_references` invalid-mode smoke confirm required API compatibility; do not overwrite shared active Function.

---

# Task checkpoint — #1461 accepted reversible diary quote privacy forward-port v0.58.0
Updated: 2026-11-01 Asia/Manila

- Owner accepted v0.45.2 reversible diary quote Preview and authorized merge to dev, not main/Production. Accepted stable SHA bba52bebe30bf6c40b9e9a05b08dbaf67128aa22, canonical #41229542989 succeeded, trusted Preview READY; Scratch Function 6ae6337ade2cc07d0df2 active.
- Forward-port original v0.45.1 diary quote privacy plus reversible v0.45.2 from common base 343b857fa43d26e7afc7b7f6de81ac479416bba2 onto dev@029b5cb758e1180b595c9b3f6c3822eb3a995675 v0.54.0. v0.55.0/v0.56.0/v0.57.0 reserved by other Previews; candidate v0.58.0. Preserve newer feature controls, task search, storage, categories and Day View; combine both ChatPage imports. No main/Production changes.
- Visibility revocation fences and scrubs excerpts without date/epoch loss, republishing restores authorized current content; permanent deletion invalidates. Offline/nonfriends fail closed. Additive migration 016 exists on Scratch; integrated Function source requires deployment compatibility check.
- Deliver focused tests, build/PWA/size, exact stable candidate canonical and READY Vercel, Scratch compatibility, read-only promotion preflight and nondrivergent authorized Preview-to-dev PR.

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

- User accepted v0.46.0 Scratch photo Preview and requested image thumbnails in reply quotes. Source of truth: `feature/1460-chat-photos-privacy-v0460-20261101` at `19c4a716df424b016f87452b19778fb9051bb2b8`. Scratch schema and `message-action` Function activated, canonical CI passed, Production/dev/main unchanged.
- Frontend-only v0.46.1 task: show compressed existing photo in composer and inline quoted replies, resolve original IDs from local conversation across sender/recipient copies, never render deleted/unsent photo thumbnails, lazy-load thumbnail storage code and revoke URL on cleanup.
- No new media upload, Appwrite migration, Function replacement or backend write. Preserve original photo compression WebP (1024px max dimension, target 0.15 MB, max 262144 bytes) and owner-based ACL. Source absent/offline with no cached image -> textual/unavailable fallback.
- Deliver isolated source commit, focused tests, canonical CI and exact-SHA READY Scratch Preview. Outstanding: manual browser/device photo-reply test, original cross-device ACL acceptance. Do not promote to dev/main/Production without explicit approval.
- Issue: https://github.com/carlers/mosaic-life-tracker/issues/1460

---
