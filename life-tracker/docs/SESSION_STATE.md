# Session checkpoint

Updated: 2026-10-10
Task: fix chat route animation jitter, #471 follow-up.
Stable baseline: feature/navigation-polish e15d597341e8b91e60bf3a7cf3df1133c1c3a000 (v0.11.1), CI 38006657273 SUCCESS.
Work branch: chatgpt/chat-route-jitter-fix. Target stable Preview: feature/navigation-polish, v0.11.2.
Do not promote to dev/main; dev independently contains #465/#466 at 6ebb6ad, main unchanged.

## Root cause / change

- Switching between regular Messages and Chat changes MainLayout's *same outer shell* from relative, scrollable h-screen with BottomNav to fixed h-dvh without BottomNav while its inner route motion is active, forcing reflows and perceptible jumps.
- RouteViewportTransition retains independently sized regular/chat MainLayout shells until the 210ms slide completes. Keyed chat frames leave ordinary navigation on the original inner compositor; app data providers remain shared outside the boundary.
- Preserve browser Back/Forward direction and suppress duplicate slides after committed finger gestures. Outgoing shell is aria-hidden/inert. Existing chat visual viewport sizing and composer/scrolling behavior are retained.
- DOM and real-Chromium regression assert independent shells and stable chat/parent geometry during both transition directions.

## Diagnostics

- Initial full CI 38008378910 identified an undefined Framer variant custom on initial mount and measured only +140 B PWA precache over previous ceiling. Production entry, initial closure, Home and aggregate raw/gzip passed.
- Repair computes entrance/center from the current panel's settings; the parent AnimatePresence supplies the NEXT navigation's direction for the outgoing exit variant (including none after an already-completed swipe). Narrow measured PWA/raw/gzip headroom is synchronized to budget tests; entry/initial/Home ceilings remain untouched.
- Second full CI 38008704702: lint, build/PWA/size, DOM shards 1/2 and Chromium shard 2 SUCCESS. The only red gate was the new Chromium chat geometry test starting before the React/Vite harness had mounted. Fixed by waiting for the probe's actual button; geometry checks unchanged.
- Final task requires browser-focused proof, stable Preview squash and exact-SHA canonical/Vercel READY. Android hardware and authenticated Scratch Preview/keyboard behavior are still manual checks, not asserted.
- No backend/cloud changes; #404 excluded.
