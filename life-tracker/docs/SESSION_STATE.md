# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #855 bounded Day View far-date navigation regression repair (v0.29.2 Preview only).

## Verified baseline
- Owner-tested published Production v0.29.1: `main@b952f71ecd2add3172f90104bc0e856a2648ccc9`, Quality Gate #38903977976 SUCCESS, Vercel Production READY, GitHub Release publisher #38904182695 SUCCESS. User installed and reports normal laptop+phone PWA operation; specific Web Push and delayed offline SW upgrade remain independent acceptance.
- Protected `dev@f9e01b6fc8f8913b75a9738fc978c0ed55427d98` remains v0.29.1. No v1.0.0 approval, tag or protected promotion.
- Separate #914 source-only supported-release pin + disposable Phase B rehearsal procedure is stable `security/914-release-client-compat-20261016@eec2d3bfabb945ee91790a06213827b5028aac1a`; task focused #38913427677 PASS, stable full Quality Gate #38913679530 SUCCESS and exact artifact trusted Preview Delivery #38913955908 SUCCESS. Real old/new offline/permission rehearsal **NOT RUN**; do not represent that as a PASS. No dev/main merge authorized.

## #855 current scoped fix
- `useDayViewSwiper` previously anchored its 181-day logical window forever at initial selectedDate. Any later external date selection beyond ±90 days clamped to the boundary; continued daily swipes eventually hit the last slide. The existing 19-day test did not exercise this.
- Re-anchor only when committed selected date approaches ±87 days, preserve ordinary short navigation and fast-swipe window; keyed Swiper remount resets the virtual DOM to the centered selected day. Add focused React regression tests for far-forward, far-backward, near-edge, subsequent arrows and unchanged short-jump behavior.
- Product version candidate **0.29.2** (PATCH user-testable fix) in package, lock root metadata and appVersion. No Appwrite schema/Function, Scratch, Production or design system changes.
- Task branch `chatgpt/855-day-view-window-20261016` must pass focused CI before squash into `fix/855-day-view-window-20261016` stable Preview with full Quality Gate and Vercel READY. No automatic dev/main promotion.

## Next action
- Run focused CI for the exact #855 task commit; investigate and repair failing unit/react/contracts checks, then stable Preview full canonical and trusted CI-first Preview delivery.
- Only after stable Preview acceptance propose this fix for separately authorized `dev` integration; do not tag or release v1.0.0.
- Continue #745 permanent chat rejection audit and #914 live isolated old/new-client PWA rehearsal; #889 owns the eventual 1.0 go/no-go review and requires explicit owner approval.
