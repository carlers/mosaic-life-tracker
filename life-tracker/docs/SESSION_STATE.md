# Session checkpoint

Updated: 2026-10-10
Current task: issue #471, automatic route transitions plus Reduce animations.
Baseline: accepted stable navigation Preview feature/navigation-polish `fb8b9b637574a635842fdbae7668c09bdbfdedd6`, v0.11.0. Full canonical CI 37965396049 SUCCESS, Vercel READY. dev remains v0.10.1; main unchanged.
Task branch: `chatgpt/unified-motion`; stable Preview target: `feature/navigation-polish`; candidate version: **0.11.1** (PATCH revision of user-testable v0.11.0 navigation). Do not merge into dev/main without separate approval.

## Approved contracts
- Existing MainLayout compositor animates both tap-driven and gesture-driven protected routes. Direction derives from primary nav order, known parent/detail routes, and POP history indices (Back vs Forward); initial auth/redirect unchanged. Touch swipe completion is not double-animated.
- Preserve sheet/modal history ownership and distinct vertical sheet animations. Keep chat fixed-height overflow contracts and never premount extra account/RxDB providers. Preserve reduced-motion gesture usability.
- Add account-synced Reduce animations toggle (off by default), with per-account cache and device reduced-motion override. AppearanceProvider already owns settings: no additional useRxCollection subscriber.
- Apply effective motion to MotionConfig, page, BottomSheet exit, Swiper/Embla snap and nonessential CSS transitions. Progress indicators, functional direct manipulation and focus remain available.
- Explicit #404 large-screen layout redesign is out of scope.

## Verification and remaining acceptance
- Pure unit tests for route direction including POP Forward/Back, history indices and account caching; DOM checks for preference toggle and route motion presence; existing Playwright gestures, chat viewport and sheets remain required.
- Build budgets near ceilings: run full task diagnostic, identify and fix any build, TS/lint, DOM or browser failure before publishing Preview. Exact-SHA Preview canonical CI and Vercel READY then verify.
- Physical Android Back / BottomSheet and laptop trackpad smoothness, Light/Dark/Black and reduced motion remain separately human acceptance; authenticated scratch Preview login may be blocked by platform quota.
- No Appwrite migrations/cloud, no production promotion.

## Next action
First full diagnostic 38005875755: lint, DOM shard 2, both Chromium browser shards and dependency audit green; build failed TypeScript overly narrow route-parent array; DOM shard 1 failed because its existing matchMedia mock reused one listener for two media queries. Repairs typed the parent array as readonly string[] and made the color-scheme test dispatch only its own listener, with added provider-level Reduce animations sync/cache coverage. Rerun full diagnostic to measure production size and verify fixes, then stable Preview.

## Second diagnostic

- Full task run [38006100358](https://github.com/carlers/mosaic-life-tracker/actions/runs/38006100358): DOM shards and dependency tests passed; route transition TypeScript still failed because `alternateParents` exists on only some members of the discriminated protected-route union. The corrected implementation combines the `'alternateParents' in route` guard with an explicitly broad `readonly string[]` collection, covering both compiler errors without casts.
- Next required proof: production TypeScript/build/size on exact task SHA, followed by complete stable-Preview acceptance. Do not adjust size caps without the emitted measurements.

## Measured bundle review and OS setting hardening

- [Full task diagnostic 38006217711](https://github.com/carlers/mosaic-life-tracker/actions/runs/38006217711) passed TypeScript, lint, DOM/unit/handler and browser contracts but the strict production build reported aggregate overages: raw app assets **2,310,102 B** vs 2,307,500 (+2,602 B), gzip **710,561 B** vs 710,000 (+561 B), unique PWA precache **2,392,809 B** vs 2,390,000 (+2,809 B). Entry/raw/gzip, initial closure and Home closure **passed**. New route-motion + synced motion setting is intentional shipped capability.
- Review only +4,000 B raw, +1,200 B gzip and +4,000 B unique precache limits; preserve all startup and Home ceilings and corresponding regression guard. The small extra runtime changes below require a fresh measured build to accept these caps.
- OS reduced-motion changes while the app is open should also update Swiper and Embla, not only Motion. Expose `effectiveReducedMotion` via existing AppearanceContext and subscribe those existing view consumers; add DOM live-media regression, without adding a settings/RxDB owner.
- Task repair verification then canonical exact-SHA Preview needed. Device acceptance still unclaimed. dev/main unchanged.
