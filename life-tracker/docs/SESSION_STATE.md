# Session checkpoint

Updated: 2026-10-11
Current task: reconcile accepted granular release-history Preview with newer dev checkbox fixes, then promote to dev. Candidate v0.16.10; no main promotion authorized.

## Baseline and rationale
- dev `a806d63a98100efc725af65f823d36b1366b6c7d` at v0.16.8 includes cross-task focused-input checkbox regression fix and its coverage.
- Accepted release-history Preview `feature/granular-release-history` at `290b74f10ce9e236f059e60f549b8f48870df7cb` (v0.16.9), full canonical Quality Gate `38111231237` SUCCESS, exact Vercel Preview READY.
- The branches diverged. Integrate the release-history implementation onto current dev without overwriting checkbox changes, and assign v0.16.10 to the new combined user-testable Preview tree.

## Candidate
- Preserve all dev task/checkbox code and tests. Add the accepted compact Markdown/offline release history and verified shipped/Preview-only version archive plus trusted publication milestones.
- Reuse the accepted Preview's release-only code/docs/tests/build budget, preserve the dev project reference and ownership behavior.
- Keep no Appwrite backend changes and no changes to main. Three version files must match v0.16.10.

## Verification and next action
- Check task focused CI, squash into `feature/granular-release-history-dev-integration`, then verify exact-source full canonical CI and Vercel Preview READY.
- Only then create/promote a merge PR into dev, retaining its existing checkbox fixes.
- Review production build-size thresholds and failure output; repair before promotion if necessary.
- Real iOS/Android/browser visual, authenticated and offline acceptance remain manual; do not claim completed.
