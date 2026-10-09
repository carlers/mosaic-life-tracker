# Session checkpoint

Updated: 2026-10-09
Current task: #410 Escape-as-Back + #416 trackpad navigation
Task branch: `chatgpt/desktop-navigation-inputs`, based on dev `281a95dde841bc12c9b8a2ba8374f1bdb5687dc1` (v0.7.1)
Stable Preview target: `feature/desktop-navigation-inputs`
Candidate Preview version: 0.8.0

## Objective and scope

- Add an opt-in, account-synced Escape navigates back preference, default OFF.
- Preserve nested BottomSheet/browser Back priority, active editing, chat search/reply, Day View selection and photo overlays; never exit app at Home.
- Add conservative pixel-mode horizontal trackpad gestures to the existing route swipe compositor, preserving scrollable/carousel ownership, edge restrictions and a post-navigation inertia cooldown.
- Preserve visual design, data/backend contracts, v0.7.1 dark task-text fix and touch swipe behavior.

## Work prepared

- Shared keyboard handler rendered only inside authenticated data shell.
- Existing chat transient modes now mark handled Escape.
- Reused pointer compositor for trackpad settling; unit/DOM coverage for route history, overlays, editable controls and wheel ownership.
- Version 0.8.0 in all three required files.

## Verification and release boundary

- Task branch focused checks must pass before squash merge to stable Preview.
- Stable Preview requires canonical static/unit/DOM/browser/build/PWA/size checks and exact-SHA Vercel READY.
- Raw app-size baseline at v0.7.1 was nearly exhausted; measure before any budget adjustment, and justify intentional capacity for the new feature.
- Real laptop native-trackpad and Android Back/device acceptance are not performed. No dev/main promotion authorized.
