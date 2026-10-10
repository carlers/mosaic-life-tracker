# Session checkpoint

Updated: 2026-10-11
Current task: Fix PWA update/install prompt visibility and keyboard focus around BottomSheet portals.
Baseline: `dev` `c02536a2b37ddd04c7fd81c93a8233db8bc67e0d` (version 0.12.1).
Task branch: `chatgpt/pwa-prompt-sheet-layers`; stable Preview: `fix/pwa-prompt-sheet-layers`.
Planned Preview version: 0.12.2 PATCH; reconcile any newer independent Preview/dev versions before promotion.

## Root cause

`PwaPrompt` renders inside `#root` with a high z-index, while the shared BottomSheet correctly makes `#root` inert and traps focus in its body portal. The visible prompt can overlap a modal despite being non-interactive. Raising z-index alone cannot fix inert/focus restrictions.

## Changes

- Move the shared visible-sheet snapshot and focus-return handling into a small framework-free module, without altering BottomSheet history, gesture, or exit contracts.
- Defer non-modal install/update offers until the last visible sheet finishes exiting; retain lifecycle availability, never auto-activate an update or consume an install request.
- Reset the PWA action's busy state after resolved browser install/update actions.
- Add component regression coverage for nested sheets, preserved offers, focus ownership, and re-enabled install actions.
- Document the prompt/sheet invariant in Project Reference §24.13.

## Next action

Commit as one task checkpoint with `[verify:focused]`, inspect related checks, create task PR against stable Preview and squash only after focused CI succeeds. Stable Preview requires canonical acceptance and Vercel READY. No Appwrite backend changes. Device/browser acceptance remains: update/install prompt pending through nested, drag-dismiss, Escape/Android Back, and sheet exit.

Parallel work: issue #476 historic v0.12.1 release bootstrap has separate branch/issue history; verify its live state independently if resuming it.
