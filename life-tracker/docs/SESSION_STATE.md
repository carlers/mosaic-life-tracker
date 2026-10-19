# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1008 Playwright WebKit pre-1.0 coverage plus iPad task-entry blur-save regression.

## Boundary
- Base: protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` (v0.29.12); `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged.
- Task branch: `chatgpt/1008-webkit-task-blur-20261019`; stable Preview target: `fix/ios-task-input-webkit-1008-20261019`. Proposed user-testable Preview v0.29.13 (PATCH); no dev/main promotion approved.
- Issue #1008 is pre-1.0 authorized for immediate work; issue #1009 records Firefox as post-1.0 planning only.
- No backend/schema changes; Preview remains Scratch-only. Real Safari installed PWA verification is a separate manual requirement.

## Changes being delivered
- Nonempty inline new-task drafts commit on blur even without an iPadOS keyboard Done key; preserve empty/cancel, checkbox, and continuous Enter semantics.
- Await local creation in Day View, show failure feedback, and retain the unsaved draft instead of closing prematurely.
- Add a small Playwright WebKit task-entry regression lane in CI beside the existing Chromium browser contract gate. Avoid unsupported Chromium CDP gestures in WebKit.

## Verification
- Branch commit and focused / WebKit CI not yet verified; do not claim green until actual workflow results are inspected.
- Stable Preview canonical acceptance, Vercel READY, disposable-user end-to-end verification, and actual iPad Safari/PWA acceptance are pending.

## Next action
- Publish the coherent `[verify:browser]` task commit, inspect and repair focused/browser CI. If green, squash to stable Preview and verify canonical CI and Preview delivery. Do not promote to dev/main without explicit approval.
