# Session checkpoint

Updated: 2026-10-08. Current work: accepted `feature/notifications-alerts` v0.5.1 merged to `dev` by PR #387, merge commit `9b51987f`. GitHub promotion acceptance reused the identical stable Preview tree.

## Dev delivery repair

- The new dev Vercel deployment initially failed only the `precacheUniqueBytes` guard by **416 bytes** (2,376,316 B vs 2,375,900 B). The larger Git merge subject/body was embedded in the `mosaic-build-info` HTML meta tag; app assets, PWA policy and GitHub CI passed.
- Fix on `chatgpt/fix-dev-precache-metadata` based on stable `feature/notifications-alerts`: discount **only the variable build-info content attribute** from the precache code-size regression metric, preserve shipped bytes and full commit details, and add regression coverage. No ceiling is increased.
- This is a build-only repair of the same 0.5.1 product, **not** another user-testable feature revision. Keep version 0.5.1 unchanged. Follow focused CI → squash into stable Preview → canonical CI and READY Vercel; then use exact-tree merge promotion to dev and verify READY dev deployment.
- Backend unchanged: dev and Previews target Scratch Appwrite, main targets Production. No production Appwrite mutation permitted; before main activation, the production `006-push-details` migration is still required.
- Manual device acceptance for latest account-synced Alerts retention remains outstanding.

Next action: finish the build-budget normalization fix, verify the accepted stable Preview and promote unchanged source tree to dev. Do not modify main or create production tags.
