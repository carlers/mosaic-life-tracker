# Session checkpoint
Updated: 2026-10-10

Current task: #471 chat route jitter regression.
Baseline: accepted feature/navigation-polish e15d5973, v0.11.1. Task branch chatgpt/chat-route-jitter-fix, candidate v0.11.2.
Current dev: 6ebb6ad (contains unrelated #465/#466); main unchanged. No dev/main promotion.

## Behavior
MainLayout previously switched one active outer container between ordinary relative, scrollable layout with BottomNav and fixed visual-viewport chat layout without BottomNav during the slide. RouteViewportTransition now retains each independently sized shell across the transition; existing data providers remain shared and primary tab navigation continues using MainLayout's normal compositor. Exiting views become inert/aria-hidden, and reduced-motion/gesture completion rules remain.

## Verification
DOM and Chromium tests assert outgoing geometry during Messages-to-Chat and Chat-to-Messages transitions.
First full run 38008378910 detected a Framer variant initialization error plus 140 bytes of PWA precache overage. Motion entrance now receives direct current-route settings; AnimatePresence controls outgoing direction. Only measured aggregate headroom was revised, keeping startup/Home ceilings.
Second full run 38008704702 passed build/PWA, lint, both DOM shards and Chromium shard 2; only the new browser fixture failed.
Browser-focused run 38008914677 demonstrated that the new isolated harness never mounted. MainLayout's BottomNav requires UnreadMessagesContext normally provided by ConversationsProvider. The fixture now provides static unread context (no extra subscription), and the browser test first waits for the probe control to mount.
## Next action
Repair the mandatory checkpoint headings, revalidate the exact stable Preview SHA with full canonical CI and Vercel READY, then report verified v0.11.2. Physical Android Back, chat keyboard/IME, Scratch authentication and perceived smoothness remain manual checks.

Final review: exit variant must use the outgoing panel's own Chat/standard geometry when applying the next navigation's Back/Forward direction. Regression should assert signed horizontal travel as well as stable heights/tops. Prior browser-focused 38009186695 passed, but this last directional hardening needs new focused-browser evidence before Preview squash.

## Stable Preview diagnostic

- Preview v0.11.2 at `b82b81e1` passed build/PWA budgets, TypeScript/lint, both DOM shards, and browser shard 1 in run 38009792260. Its unit/documentation contract test rejected missing `Current task:` and `Next action:` headings. This correction changes only the checkpoint and does not alter running app behavior or version.
- Follow workflow: focused task CI, squash into same stable Preview, then exact-SHA full canonical acceptance. No dev/main promotion.
