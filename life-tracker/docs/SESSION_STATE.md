# Session checkpoint

Updated: 2026-10-10
Current task: fix user-observed chat route swipe jitter (issue #471 follow-up).
Baseline: accepted stable Preview `feature/navigation-polish` `e15d597341e8b91e60bf3a7cf3df1133c1c3a000`, v0.11.1, canonical CI 38006657273 SUCCESS and Vercel READY. Concurrent dev is separately at v0.11.0 `6ebb6ad78d27ce92d58df557ced5553ed5f59e2d` (issue #465/#466); main unchanged.
Task branch: `chatgpt/chat-route-jitter-fix`; stable Preview: `feature/navigation-polish`; candidate user-testable PATCH **v0.11.2**.
No dev/main promotion authorized.

## Root cause
- Under v0.11.1 the Framer page compositor lives **inside** MainLayout. Switching between Messages/other pages and Chat toggles the *same parent shell* between `relative h-screen` / scrollable with BottomNav and `fixed h-dvh` with visual viewport resize and no BottomNav while the child panel animates. This forces content/scroll geometry to change while the transition is running (chat header/dock and exiting parent can jump), even when the transform itself has a smooth easing.
- Isolate the chat boundary only: a lightweight outer `RouteViewportTransition` keyed to chat route identity vs stable standard-page identity retains the outgoing and incoming *entire* MainLayout shells at their original geometries for the slide. One Appearance/Friends/Conversations provider tree remains outside this boundary, and ordinary page changes still animate within MainLayout. Exiting shell is inert/aria-hidden.
- Preserve chat height and visual-viewport handling, BottomNav ownership, old direct swipe completion suppression, and OS/app reduced-motion behavior. No new animation library or backend changes.

## Verification
- New DOM test checks both independently sized shells co-exist during chat enter/exit and other tab changes reuse a stable shell.
- Browser interaction harness exercises **real MainLayout** geometry with a scrolling Messages parent and fixed Chat header/dock during forward and backward transitions, measuring 8 real animation frames and asserting stable outgoing height/top. Preserve existing chat geometry and route gesture acceptance tests.
- Run focused browser CI on task SHA, repair failures as needed, then squash to stable Preview and require exact-SHA canonical CI + Vercel READY. Check app-size headroom before acceptance. Device/manual real Android Back, phone viewport keyboard and rapid swipe feel remain unverified.
- #404 large screen refactor and unrelated dev fixes are out of scope. Dev/main stay unchanged; combine separately on future approved promotion.

## Next action
Commit scoped source/tests/docs/version tree, run focused/browser CI, repair any failures and publish exact-sha verified v0.11.2 stable Preview.
