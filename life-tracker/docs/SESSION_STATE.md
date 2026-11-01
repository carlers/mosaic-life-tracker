# Universal scroll-aware BottomSheet v0.74.0 — version collision reconciliation (2026-11-02)

- Previous v0.73.0 stable Preview `feature/universal-sheet-pull-v0730-20261102@9a5f2deb271d236695e5b7e8a0a7f24403450598` passed focused run #41337496807, canonical run #41337846522 and trusted Preview #41338196300. Exact-SHA Vercel deployment `dpl_EHV4Zzs8CYRtxRE8eQdLyqPsfhKK` READY. Another concurrent stable feature `feature/1026-chat-alerts-controls-v0730-20261102` independently published the same v0.73.0. Preserve the accepted implementation but assign the next unoccupied line v0.74.0; the v0.73.0 branch must not be promoted.
- New task branch `chatgpt/universal-sheet-pull-v0740-20261102`, new stable `feature/universal-sheet-pull-v0740-20261102`; version-only change in package/package-lock/appVersion plus this checkpoint. Require fresh focused and full canonical exact-source + trusted READY. Scratch/Production schema unchanged. Manual Android/iOS acceptance and dev promotion remain gated.

---

# Universal scroll-aware BottomSheet dismissal v0.73.0 — 2026-11-02

- User authorized extending Day View pull-down-to-close to standard bottom sheets globally. Base `dev@62a839fb4c2d22f1a77ee357f797df4ed19f98c8` v0.68.1; isolated task branch `chatgpt/universal-sheet-pull-v0730-20261102`. Planned Preview v0.73.0 (v0.69–0.72 active feature lines); confirm no later version conflicts before publishing.
- Shared BottomSheet captures one-finger downward touch at the initial top of every nested vertical scroll owner, follows finger via Framer Motion y value, spring-restores a short pull, and routes confirmed dismissal through existing stack/history. A touch beginning mid-scroll remains native for its entire lifetime; upward/horizontal intent, header drag, reorders, editors, stacked sheet locks and opt-out content retain ownership. All content modes, including Day View's nested scroll body, participate; no Appwrite/data/backend changes.
- GitHub-connected implementation and browser regressions; Vercel Sandbox creation is blocked by account snapshot-storage Hobby quota (HTTP 402; resets 2026-12-01). Use GitHub CI for focused and canonical gates. Pending: focused [verify:browser], stable Preview squash/merge, canonical gate, trusted Scratch Vercel exact-SHA READY, and manual Android/iOS gesture acceptance. Do not promote to dev/main/Production without explicit approval.

---

# #857 Category Manager discovery and filters v0.68.1 — 2026-11-02

- User approved next user-visible category-lifecycle refinement after approved `dev@5c29f7d32b140ff1c1130a6235e8e9736acc2524` v0.68.0. Scope is **frontend only**: Day View three-dot category menu gains context-specific `Manage category…` action, opening the same lazily imported Category Manager with that category’s inline edit form expanded and scrolled to; Preferences → Tasks & Categories gains a separate `Manage categories` row; Category Manager adds All/Active/Retired filters, case-insensitive search, zero-match state and reorder protection during filtering.
- Active/Retired classification follows date-effective retirement: a category is retired when its inclusive last-active date is before the owner’s current local date. Future scheduled retirement stays Active. Original full-list ordering and reverse controls remain available under `All` with empty search; filtering never rewrites hidden-category order. No task/category server or RxDB changes.
- Task branch `chatgpt/857-category-discoverability-v0681-20261102`; version 0.68.1 set in three files, regenerated component index, Settings search index updated. Targeted 80 category/settings/reorder DOM tests initially green; targeted shortcut and semantic tests added; ESLint with eight pre-existing DayViewSheet hook warnings, no new errors; contracts/version and TypeScript/Vite/PWA blocking size checks green. Final focused GitHub CI, stable v0.68.1 canonical acceptance/READY Preview and owner manual device acceptance still required. No dev/main/Production promotion authorized for this refinement.

---

# #857 Category lifecycle accepted Preview integrated with dev v0.67.0 — 2026-11-02

- User explicitly approved category lifecycle #857 for dev. Accepted stable Preview `feature/857-category-retirement-v0560-20261101@052202b1e0794cef5ea39b86a93b10958f91d335` v0.56.3, full canonical #41323791699 SUCCESS and exact-SHA Vercel Preview READY. Signed Scratch two-account acceptance: 14-task resumable move, Delete-All and empty-category deletion, cross-owner denial, ACL cutover verified; synthetic records cleared. Shared active Scratch Function deployment `6ae765943b465ba13e8c` READY, gate enabled; Production untouched.
- Live dev advanced independently to v0.67.0 `e0094b386d47bcdb02a2bc69c57d02a10935db7c`; direct category Preview promotion is divergent and would regress version. Preserve newest dev messaging/photo/bug-report features; integrate the accepted category branch in isolated v0.68.0 Preview with unique Appwrite migration id `020-category-retirement` (existing dev 016–019 reserved). Run focused unit/handler/DOM and full PWA size, canonical exact-SHA and trusted Vercel Preview. Promotion to dev is authorized, main/Production are not. Integrated tree needs new Preview verification before promotion.
- Keep destructive category operations source-controlled. Do not independently deploy the merged older source Function to Scratch: current live shared media-safe Function is separately verified. Manual device acceptance of integrated dev still remains separate.

---

# Issue #1026 — optional chat initiation controls v0.67.0 (2026-11-01 Asia/Manila)

- Owner completed v0.66.0 manual flag testing and explicitly approved promotion to `dev` and continuation. Stable `feature/1026-safe-initiation-controls-v0660-20261101@12aa12dfe4fffcd4353093c1e7634be7aef0a884` accepted via focused #41312035664, full canonical #41312320442, trusted Preview #41312668961, and protected promotion preflight #41318187620. PR #1593 merged to `dev@53c70b9f26ce5ad835adcd35f0152705679cf824`; accepted source tree identical, exact-SHA dev Vercel READY. No `main` or Production promotion.
- Current isolated v0.67.0 task branches from exact dev SHA. New PostHog disable keys: `mosaic_disable_chat_photo_upload`, `mosaic_disable_chat_reactions`, `mosaic_disable_chat_sticker_sending`. UI presents optional controls only when enabled; handlers recheck before new photo staging, reaction mutations or pack/GIPHY sticker sends. Historical incoming/outgoing photos, queued message delivery, rendered reaction badges, sticker payloads and ordinary text/reply/unsend actions remain unaffected. Flags remain client presentation/initiation only, not permissions, revocation or backend capability.
- Node 22.23.4 sandbox: six focused test files 14/14 passing (including new chat-control UI/hook and photo-staging guard), zero changed-file ESLint errors (one unrelated existing ChatPage dependency warning), `version:check` and `contracts:check` passing, production/PWA/size build passing (Home closure 380389/381000 gzip bytes). No backend/schema/Function changes and no PostHog state changes yet.
- Next: scoped `[verify:focused]` task commit and focused CI, squash onto fresh stable v0.67.0 Preview, full canonical and trusted exact-SHA Scratch Vercel READY. Only then create three unique inactive PostHog Preview flags and read back all flags. User device testing is required before v0.67.0 can be promoted to dev; never promote to main/Production without a separately explicit authorization.

---

# Feature flags #1026 — three safe initiation controls v0.66.0 in task verification
Updated: 2026-11-01 Asia/Manila

- 18 previously owner-tested reversible controls promoted to `dev@a3e2045336c57c18392f87da48f63ddf95f6bd30` v0.65.0 by approved PR #1589. Source tree identical to stable Preview `c34f7c36e8441bd203fd604c06c4c65a88fcb0ca`; postmerge Quality Gate #41311108213 succeeded, exact `dev` Vercel READY. Emergency RxDB DB6 v5→v6 migration preserved. No main/Production change.
- Next isolated v0.66.0 batch based on exact new dev tree: `mosaic_disable_bucket_list_creation` (prevent new aspirations, preserve existing), `mosaic_disable_friend_requests` (block new sends before offline queuing while letting already queued requests flush and existing friends/accept/cancel/block remain), `mosaic_disable_push_enrollment` (reject new device subscriptions before browser permission prompts while permitting existing subscriptions/opt-out and Alerts). Flags are operator initiation-only controls, not service shutdown, revocation, auth or backend capability.
- Changed UI entry points and direct command boundaries, independent typed registry, data-preserving operator docs and regressions; no migration, existing record deletion, background sync changes, remote PostHog creation/activation or service mutations. Version v0.66.0. Run local targeted tests, lint, Node22 build and size; then task focused CI, stable exact-SHA full canonical, trusted Scratch READY. Register only three distinct INACTIVE flags after validated Preview delivery and request owner test; no dev/main/Production promotion of this new batch without separate approval.

---

# Feature controls #1026 — v0.65.0 reconciliation after emergency DB6 recovery
Updated: 2026-11-01 Asia/Manila

- Owner completed four-control manual testing and explicitly approved `dev` promotion plus further feature work. Previous v0.65.0 Preview `7a2eb50d7f592794c47857abf411c4c6c340997e` passed full canonical #41303993224, trusted Preview #41304252193 and exact-SHA READY Vercel, but `dev` advanced to emergency RxDB message schema fix v0.64.1.
- Rebase on exact protected `dev@027bf023b975655e73ffb14a3f83e39a36d08563` v0.64.1. Preserve message v5→v6 schema migration, offline queued-chat-photo repair, earlier chat photos and public bug reports. All 14 carried-over optional flag code/test/operator-document blobs match the previously accepted v0.65.0 Preview byte-for-byte. Version set to 0.65.0 in all three files.
- Local ephemeral Vercel sandbox Node 22.23.4: 26 focused unit/DOM tests passed (including emergency metadata/Diary tests), changed-file ESLint zero errors and eight existing DayViewSheet hook warnings, contracts/version passed and full production PWA build/size passed (Home closure 380133/381000 bytes). No remote PostHog state was changed and no backend schema or Function modifications.
- Next: `[verify:focused]` task commit, fresh stable exact-SHA full canonical and READY trusted Scratch Preview; then approved protected Preview→dev promotion only if preflight passes and the DB6 incident rollout gate remains safe. Never modify main/Production. The emergency dev alias rollback must not be inadvertently overridden without recovery verification.

---

# Emergency recovery — RxDB messages DB6 (2026-11-01)

- Dev v0.63.0 introduced chat photo fields on the messages collection at schema version 5, changing the schema hash without a required version bump; v0.64.0 retained the regression. Older devices fail startup with RxDB DB6.
- Emergency Vercel dev alias was reassigned to the existing READY v0.62.0 deployment (SHA 8dccaddc8d5045b96b18e81dc818c84af3db28d6). GitHub dev HEAD remains 67289fe56f7f78631e325a7d2e98b7eed768f176; direct update was blocked by branch protection. Do not clear local app storage.
- This v0.64.1 fix increments messages schema to 6, supplies the v5→v6 data-preserving migration, and adds regression tests for old and queued-photo rows. No backend migrations or Production changes. Complete task focused verification, canonical Preview, and Vercel READY before protected dev promotion; do not replace the temporary dev alias early.

---

# Task checkpoint — #854 integrated public bug reports v0.64.0 on latest dev baseline
Updated: 2026-11-01 Asia/Manila

- Owner confirmed public GitHub bug reporting working on mobile and authorized adding an internal-reference copy icon and promoting to dev. Merge the full accepted bug report capability, not just the icon, while preserving newer work.
- New baseline dev@f00c0dd63c9a6907c320db267d9a9d4dfbd97d5b (v0.63.0) includes accepted private chat photos; accepted bug-report Preview@eab8ead35ad67dac7320c672ce6ece16969b9c76. The reconciled v0.64.0 candidate retains migration 017 chat photos, 018 private reports and 019 public GitHub receipt, both chat photo orphan cleanup and private report expiry, and newer dev handlers/schema.
- Confirmation UI adds an accessible copy icon for the exact internal reference, success checkmark and visible error on clipboard failure; public consent and private diagnostics handling unchanged.
- Gate: 48 focused unit, 20 handler, two copy-icon DOM tests, lint/contracts, production build and PWA size from previous dev baseline passed. Re-run on latest baseline, focused task CI, canonical exact-SHA stable Preview and READY Vercel. User already approved Preview to dev, but merge only exact verified integration without losing newer dev data. Main and Production remain untouched.

---

# Current task: #1460 accepted chat-photo feature on latest dev v0.63.0
Updated: 2026-11-01 Asia/Manila

- User accepted chat-photo v0.46.1 and authorized dev promotion. Previous v0.59.0 integration at stable Preview `feature/1460-chat-photos-dev-integrated-v0590-20261101@82730953df66301ed664e7949ef0554bee8511c5` passed canonical #41293693312 and Vercel READY but could not promote because dev advanced from v0.58.0 to v0.62.0.
- New dev baseline `8dccaddc8d5045b96b18e81dc818c84af3db28d6` v0.62.0. This candidate merges the canonical passed v0.59.0 source atop v0.62.0, preserving all later feature controls, bug reports and Home/UI code; version now v0.63.0. No Production/main change.
- Requires fresh focused and full canonical CI, Scratch-only Preview Vercel READY, read-only Scratch deployment/feature-scope proof, and manual acceptance of changed integration tree before stable→dev promotion per DELIVERY.md. No backend writes required. Do not claim unperformed device/ACL tests.
- Issue: https://github.com/carlers/mosaic-life-tracker/issues/1460.

---

# Task checkpoint — #1026 accepted 14 control registry dev reconciliation v0.62.0
Updated: 2026-11-01 Asia/Manila

- Owner explicitly accepted all seven new P1 feature switches on Preview and authorized integration to dev, not main or Production. Prior six controls already in dev v0.54.0; TodoMate v0.55.0 and seven further non-destructive switches v0.57.0 require forward-porting.
- Accepted source Preview `feature/1026-p1-seven-controls-v0570-20261101@d618bbe05b378d13dda1ea0d51910719fd990ba1`: canonical #41234343819 success on attempt 1, trusted Preview delivery #41234684743 READY, exact Vercel deployment verified. All 14 flags in PostHog 619969 registered inactive and read back, zero behavior disabled.
- Latest dev baseline `50d5afb2cf7d04c3739a482736b815008eea1405` v0.58.0 includes later diary-quote privacy features; preserve `useDiaryReferencePreviews`, reference authorization and quote redaction. Other flagged files match earlier dev baseline and can be adopted exactly from accepted Preview. ChatPage retains the new dev source and updates only two flag calls to exact strings.
- v0.59–v0.61 candidates are reserved by concurrent Chat photos/storage/bug-report work. Choose free v0.62.0 for isolated integration Preview; synchronize all version files. No new flag creation or rollout mutation in this integration.
- Run task focused CI, squash onto stable `feature/1026-registry-dev-integrated-v0620-20261101`, exact-SHA full canonical + Home size budget + trusted Vercel READY, read-only promotion preflight and explicitly approved stable Preview to dev PR. Abort on semantic divergence. User's authorization does not extend to main/Production.
- After dev promotion, continue #1026 on separate task branch with safe optional flags; prioritize non-data-bearing controls before evaluating social/push/bucket-list boundaries. No unrelated changes, no data deletion.

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
