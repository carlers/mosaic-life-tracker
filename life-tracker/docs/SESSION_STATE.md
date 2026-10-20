# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #856 — accepted cross-day drag UX refinement.

## Source and owner acceptance
- Owner confirms v0.34.2 successfully moves tasks between days with real held mouse dragging and no reported phantom cursor drag.
- Stable Preview starting point: `feature/cross-day-drag-856-20261020@bf1ab0a853cbf288d9f490917ea9835cbf5c81ba`, exact-sha Preview READY, full canonical CI #39424383631 SUCCESS.
- Current `dev@27c4725e382c8f57b6302c382fc4ece7f30d05b2` is independent v0.33.2. Do not promote/mix branches without explicit authorization.

## Authorized v0.34.3 refinement
- Scope exactly two owner-requested improvements: shorten initial edge hover dwell from 410 ms to 320 ms, and reduce consecutive cooldown from 330 ms to 230 ms (repeat remains 230+320=550 ms after slide settle); allow cursor/finger X past left/right Day View boundaries to continue edge navigation while Y remains vertically aligned.
- Safety remains unchanged: physically held task pointer identity/button gate, release/cancel/blur cleanup, no multiple in-flight slide transitions, virtual Swiper active-date guards, and one final drop write. No schema/backend changes.
- Unit regression covers beyond-left/right X and excluded vertical exit. Real desktop Playwright held-mouse regression moves beyond right to next day, beyond left to previous day, and moves beyond edges post-release to confirm nothing navigates.
- Task branch `chatgpt/856-faster-outer-edge-20261020`. PATCH Preview candidate 0.34.3.

## Verification / next steps
- First focused/browser Gate #39426953082: focused checks and 1 browser shard passed; desktop regression failed its **test fixture setup** because default full-width sheet extends to viewport edge (right=1263 and testing beyondRight=1293 outside 1280 browser). Test now applies the existing compact-sheet geometry before trying both outside edges within browser. Re-run `[verify:browser]` for decisive proof, then squash existing stable Preview branch and obtain full canonical acceptance + exact-SHA READY Preview.
- User test remains needed for final speed feel and real Android/iOS/safari edge behavior. Extended >87-day rebase, final drop persistence/offline sync remain additional manual acceptance; issue #856 stays open.
- No `dev`, `main`, Production, or 1.0 release authorized.
