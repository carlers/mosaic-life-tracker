# Session checkpoint

Updated: 2026-10-10
Current task: Issue #489 — static-first GIPHY sticker playback v0.16.2.
Baseline: `feature/sticker-libraries` SHA `c0116e8f1f904b1963dbd28f2f26fb1e63fa7381` v0.16.1. Exact-SHA [full Quality Gate 38070001071](https://github.com/carlers/mosaic-life-tracker/actions/runs/38070001071) SUCCESS and Vercel `dpl_DUenndUAgnrAewS6aF5oCyuMwoyK` READY, with a branch-only GIPHY Web beta key in Vercel (no literal key in Git).
Task branch: `chatgpt/giphy-static-first-489` from stable `feature/sticker-libraries`.
Do not promote to `dev` or `main` without explicit approval.

## Objective and scope
- Respond to feedback that static character-style images are preferred to always-moving GIFs, while retaining optional animation.
- GIPHY search displays only provider-supplied still GIFs (prefer 100px grid rendition). Existing ID-only `gp1` messages display provider-supplied 200px still by default. Tap an accessible Play/Pause affordance to switch between provider-supplied still GIF and animated transparent WebP. Default autoplay is off. User may enable `Autoplay GIPHY stickers` in Settings → Preferences → Motion; synced per account via existing Settings hooks, effective Reduce animations/device system setting suppresses automatic movement but explicit tap can play.
- Keep original ID transport, thumbnails attribution, one-tap send, offline outbox, reactions/replies/unsend, no provider URL/blob in Appwrite, no SDK/dependency, no external media cache, validated GIPHY hosts and failure-safe message fallback.
- Source docs: https://developers.giphy.com/docs/api/schema/ and https://developers.giphy.com/docs/optional-settings/. Renditions are not universally available: do not guess/construct still URLs. Safe to fail closed with readable placeholder.
- Version candidate v0.16.2 (PATCH refinement). Focused tests cover actual still selection, untrusted origins, default/reduced/explicit playback, provider fallback and account preference wiring. The Preview-only public Web key stays on Vercel; never commit its literal value.

## Verification
- Source edits and test additions planned on task branch. Perform focused verification, squash into stable Preview, ensure full CI canonical acceptance and matching exact-SHA Vercel READY.
- Performance: previous *keyed Vercel* measured 2,337,487 B aggregate raw, 720,877 B gzip, 2,420,938 B precache and 143,718 B initial gzip. Preflight modest extra budget headroom only for aggregate/precache due to static logic; do not relax entry, initial, Home or historical baseline without evidence.
- Manual/device acceptance remains: Scratch exact origin at 6/6 occupied platforms, actual provider key/search/analytics, two-account send, Android touch swipe/play, reduced motion, and GIPHY production/provider rights. No Appwrite changes.

## Next action
- Complete implementation and tests, run focused CI, repair failures, squash task PR to stable Preview, verify full canonical CI and same-SHA Vercel READY. Update issue #489 after verifiable results; don't add post-green status-only commit or promote dev/main.
