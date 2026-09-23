# Session state

Updated: 2026-09-23
Current task: Full-page primary swipes and functional appearance modes
Status: in progress.

## Active user prompt

> Swipe area for the other pages other than Home should be the entire page, not just the upper region. The swiping on the Me page should lead to settings when you swipe to the left, not the right. I was mistaken. Add a dark mode, light mode, system mode, and black mode in settings and make it functional.

## Progress

1. **Done — recover Preview baseline and rules.** Confirmed Preview at `2f4f13bcade1f38c0bc3a0325bed352ca65f48ba`; read current agent/session/roadmap/product/verification/deployment guidance.
2. **Done — inspect gesture/theme architecture.** Primary route gestures live in `PrimaryRouteSwipeSurface` under `MainLayout`; the bottom inset currently sits outside that surface. Me currently maps right→Settings. Settings has a placeholder Screen row and an existing synced `useSettings` store; app colors are predominantly the current dark hard-coded palette.
3. **In progress — durable contracts and spec-first coverage.** Pin full-scroll-surface route ownership outside Home, Me left→Settings (right→Chat), and persisted System/Dark/Light/Black appearance modes with immediate system-theme response and startup restoration.
4. **Pending — implement gesture corrections.** Move the bottom inset inside the transformed route surface, let non-Home surfaces grow through the full scrollable page, preserve Home hamburger-only ownership and nested horizontal exclusions, and update Me direction mapping.
5. **Pending — implement appearance system.** Add an appearance provider backed by synced settings + local bootstrap cache, a functional Settings appearance sheet, system color-scheme listening, and app-wide semantic palette overrides for the existing UI without changing unrelated layout.
6. **Pending — focused/browser verification.** Capture red→green evidence with narrow unit/DOM/browser checks and repair regressions.
7. **Pending — final acceptance and Preview rollout.** Run exact-commit `[verify:full]`, move Preview only after green, confirm Vercel READY, and record manual device/visual checks.

Roadmap pointer: settings appearance + primary-navigation interaction correction.
Blockers: None.
