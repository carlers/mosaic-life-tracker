# Session checkpoint

Updated: 2026-10-11
Current task: Fix PWA update/install prompt visibility and keyboard focus around BottomSheet portals.
Baseline: `dev` `c02536a2b37ddd04c7fd81c93a8233db8bc67e0d` (version 0.12.1).
Task branch: `chatgpt/pwa-prompt-size-repair` (after task PR #534); stable Preview: `fix/pwa-prompt-sheet-layers`.
Planned Preview version: 0.12.2 PATCH; reconcile any newer independent Preview/dev versions before promotion.

## Root cause

`PwaPrompt` renders inside `#root` with a high z-index, while the shared BottomSheet correctly makes `#root` inert and traps focus in its body portal. The visible prompt can overlap a modal despite being non-interactive. Raising z-index alone cannot fix inert/focus restrictions.

## Changes

- Keep modal stacking, inertness and focus-return logic inside lazy BottomSheet; share only a small Boolean visibility signal with the always-mounted PWA notice (first Preview exceeded initial gzip budget by 153 B).
- Defer non-modal install/update offers until the last visible sheet finishes exiting; retain lifecycle availability, never auto-activate an update or consume an install request.
- Reset the PWA action's busy state after resolved browser install/update actions.
- Add component regression coverage for nested sheets, preserved offers, focus ownership, and re-enabled install actions.
- Document the prompt/sheet invariant in Project Reference §24.13.

## Next action

Run repair task `[verify:focused]`, squash into stable Preview after green, and recheck full canonical acceptance and Vercel READY. The first stable Preview had DOM/static/browser successes but failed the initial compressed bundle budget by 153 B. This repair reduces startup-only JS instead of raising the budget. No Appwrite backend changes. Device/browser acceptance remains: update/install prompt pending through nested, drag-dismiss, Escape/Android Back, and sheet exit.

Parallel work: issue #476 historic v0.12.1 release bootstrap has separate branch/issue history; verify its live state independently if resuming it.
