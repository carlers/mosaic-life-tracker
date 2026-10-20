# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #856 — fix phantom desktop drag and inert real held cross-day drag.

## Owner observation
- Stable Preview v0.34.1, `feature/cross-day-drag-856-20261020@f7c47d671c2ea49e779c66919ec541d0b2c2ca2d`, passed canonical CI and exact Vercel READY, but the owner **still cannot navigate across days with a real held task drag**.
- On desktop, Day View sometimes follows cursor after left mouse button release. Cross-day behavior seems to track that phantom mouse motion instead of the actual drag gesture.
- Earlier regression checked a synthetic Chromium touch drag but **not** a held mouse drag or post-release mouse cursor motion. Treat v0.34.1 as rejected; do not merge into dev.

## Changes for next Preview candidate v0.34.2
- Base stable `f7c47d6`; task branch `chatgpt/856-real-held-pointer-gate-20261020`. Current dev is `27c4725` v0.33.2 (contains separately accepted pinch feature; do not overwrite).
- Arm cross-day navigation only after real primary `pointerdown` inside an active task row. Track pointer ID, actual viewport pointer coordinates and held button until release.
- Discard dnd-kit's translated `operation.position.current` as pointer coordinates. Use only corresponding native PointerEvent or the held pointer position recorded from window-level pointer events.
- Cancel external drag and stop edge timers on mouse movement with no left button, mouseup/pointerup, pointercancel, Escape, blur, visibility loss, or drag-provider end even if pointerup was not seen. Keep same-day drag/drop unchanged.
- Add browser regressions for genuine held primary-button mouse navigation and a released ordinary mouse swipe that must not continue following hover. Retain existing Chromium real-touch regression.
- Version PATCH v0.34.2 after v0.34.1 user-tested failure.

## Verification plan / outstanding
- Run focused browser gate on task branch, repair any failures, then squash into stable Preview and obtain canonical full CI plus exact-SHA Vercel READY.
- Physical device / actual account retest, persistence/offline sync, high day-count rebase and iOS Safari still unverified. Keep #856 open.
- No approval to promote `dev` or `main` or alter backend/Production.
