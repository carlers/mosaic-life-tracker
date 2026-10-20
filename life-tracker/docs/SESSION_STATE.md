# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #1126 — Reusable Mosaic Select and app-wide dropdown migration.

## Authority and exact source
- User authorized implementation of https://github.com/carlers/mosaic-life-tracker/issues/1126 (formerly planning-only).
- Base is dev@613903cd01b8857f16d4f75fa02e84b1d39e6263, v0.36.3.
- Working branch: chatgpt/1126-mosaic-select-20261021. Proposed user-testable version v0.37.0.
- Preview acceptance and dev/main/Production promotion are **not** approved. Do not merge to dev/main without further explicit approval.

## Scope
- Shared `MosaicSelect` supports controlled values, variants for standard / compact / category, viewport-clamped portaled listbox, keyboard navigation, focus restoration, disabled options, and dismissals.
- Migrate Timeline category and status controls, Preferences, Notification Settings, Diary visibility, shared task category picker, Bucket List task creation.
- Keep category colors, existing setting keys and defaults, account sync, domain callbacks and backend untouched.
- Update DOM regressions, component index, theme usage instructions and three consistent version files.

## Verification and handoff
- Source edits are assembled through GitHub Git objects; local checkout and local test runner are unavailable in this chat runtime.
- Pending: publish task commit with [verify:focused], inspect exact diff and focused Actions results; repair any failures.
- Then squash into stable Preview branch for canonical CI + Scratch Vercel acceptance. Real Android/iOS device visual/interaction checks remain manual.
- Do not claim user acceptance or release based solely on automated CI.
