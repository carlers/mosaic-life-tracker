# Task checkpoint — #1443 Preferences sync v0.44.4 integrated Preview
Updated: 2026-10-31 Asia/Manila

- Owner authorized accepted preferences-sync fix promotion into `dev`; live `dev@a9f1650f9b262705413b64e3d5b2288b53620e83` is already v0.44.2 with accepted #1386 route-swiping changes. Old accepted fix `fix/1443-preferences-sync-v0441-20261031@0552192a987b0fd31276b4f9af0f45c362f3c101` is v0.44.1 and cannot be promoted directly without version regression.
- Independently active #1386 cold-start Preview reserves v0.44.3. Forward-port only five tested preferences-sync implementation/regression files unchanged onto current dev and assign new available PATCH v0.44.4. Preserve v0.44.2 UI/settings navigation and existing runtime behavior outside the fix.
- Current task `chatgpt/1443-sync-forward-port-v0444-20261031`; stable `fix/1443-preferences-sync-v0444-20261031`. Focused verification required before squash to stable, then full canonical gate and isolated Scratch Vercel Preview READY before approved stable-Preview-to-dev PR. No main or Production approval; retain issue #1443 open pending real device preference sync acceptance.
- Previous v0.44.1 fix targeted physically deleted oversized legacy settings IDs poisoning the settings RxDB push; migration first preserves older values under canonical valid IDs and retains newer canonical values, then invalid-ID deletion is local-only. No backend schema/Function changes. Original fix had 27/27 targeted unit tests, full canonical and Trusted Preview Vercel READY.

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
