# Task checkpoint — Day View bounded momentum, complete snap and image drag v0.44.7
Updated: 2026-10-31 Asia/Manila

- Owner accepted v0.44.5 momentum Preview, then requested a hard ±1-day maximum per gesture, reliable release snap from mid-slide on mobile, and disabled native browser drag of task photos. No broad optimization or backend change authorized.
- Base: accepted Preview `perf/dayview-momentum-v0445-20261031@1fe65eb204a5ed9db63188a5258e9f44b5c43a79`; integration `dev@4aec8d63ef460cbc56a8f895f0f609a2152ea459` unchanged. Independent issue #951 reserved v0.44.6 on a separate stable Preview; choose v0.44.7 for this user-testable refinement. Task `chatgpt/dayview-single-day-snap-photo-v0447-20261031`; stable `fix/dayview-single-day-snap-photo-v0447-20261031`.
- Owner Day View retains Swiper FreeMode finger-following and the Virtual date/render buffers but intercepts only ordinary touch/mouse swipe release, preventing unbounded FreeMode momentum. Snap using a velocity-dependent Swiper `slideTo` to start index or adjacent date; parent date continues updating on transition-end. A window-capture release fallback handles mobile sequences where Swiper's `touchEnd` emission is missing, before FreeMode could apply unbounded momentum. Held task drag and programmatic day navigation still use their original paths; no change to Friend Day View.
- Mark rendered task photo `draggable={false}` and cancel its native dragstart while retaining the button's click/selection action.
- Two browser runs failed the user-observable touch-swipe commit; one also failed repeated held-task edge navigation. Dedicated Swiper event trace from browser run #41213011882 confirms touchStart and slideChange but no Swiper touchEnd/transitionEnd and `isTouched=true` after synthetic release, explaining the half-stuck slide. Window-capture pointer/touch end/cancel fallback now snaps to start±1 via Swiper slideTo, using the original pointer ID or primary-pointer fallback and requiring the final touch to lift. The held-task reorder/carried guard excludes its continuous navigation. Browser run #41213645612 confirmed the first touch swipe completed and its held-task contracts passed; separate distant-date re-open swipe and partial-swipe outcome tests failed. Adjust fallback to tolerate lost touch identifiers and accept either correct neighboring snap for a partial release; retain physical alignment and parent date parity. Also repair React ref-during-render lint with layout-effect synchronization. Keep browser checks strict; do not ship Preview until verified.
- Latest browser run #41214148487 passed held-task drag, first normal snap and focused/DOM checks, but successive swipes and a swipe after a far-date jump did not advance. Swiper's missed core touchEnd can also retain pointerId/touchId and FreeMode velocity samples; clear only those values when the window fallback handles a real ordinary swipe, so the next pointerdown is accepted. Retest all gestures and keep strict requirements.\n- Added real browser fling/half-release alignment and single-day tests, and a DOM image dragstart/click regression. First browser gate: a new synthetic -320px touch swipe traveled beyond the narrow 412px viewport and failed to commit the date; use a valid in-viewport -260px fast gesture for a meaningful assertion. The existing held-task repeated-edge-navigation test also failed on that attempt and must be rechecked before Preview. Require focused+browser gate, stable exact-SHA canonical/size/Vercel READY and physical mobile touch acceptance; no device claim or automatic dev/main/Production promotion. Future dev integration must reconcile separate v0.44.6 preview content/version first.

---

# Task checkpoint — Day View sticky momentum Preview v0.44.5
Updated: 2026-10-31 Asia/Manila

- Owner authorized only an initial Day View swipe momentum feel change; no rendering optimization, library replacement, backend, or protected branch promotion.
- Source baseline `dev@4aec8d63ef460cbc56a8f895f0f609a2152ea459` v0.44.4. Scoped task `chatgpt/dayview-momentum-0445-20261031`, stable Preview `perf/dayview-momentum-v0445-20261031`; planned v0.44.5 refinement, pending real Preview acceptance.
- Owner Day View Swiper adds native FreeMode inertia with sticky date snapping, restrained momentum, no bounce, and no inertia under reduced motion. Existing 181 logical dates, Virtual nearby DOM and 7-day render window, date rebase, transition-end parent date propagation, normal and held-task drag ownership, and sheet gesture handling remain unchanged.
- The original rapid-swipe browser test remains intact; the existing real mouse Day View transition test now also asserts that the visible next date is committed to the parent sheet. Do not infer a device performance improvement from CI.
- Initial focused failure was a missing `FreeMode` test mock, since repaired. A separate raw Swiper transform/snap-grid discrepancy (21.7px after four synthetic swipes) could not establish behavioral regression without baseline parity; that new internal assertion was removed, not the existing swipe contract.
- The fourth browser gate exposed a concrete regression: FreeMode displayed the next date but failed to update the BottomSheet selected-date label. Swiper 14 FreeMode can emit `transitionEnd` without `slideChangeTransitionEnd`; route only FreeMode settlement to `onTransitionEnd`, retaining original event for reduced-motion mode. Require fresh focused/browser tests, stable exact-SHA canonical and Vercel READY, then physical Android/PWA first/fast/swipe-back and held-task retest. No dev/main/Production promotion.

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
