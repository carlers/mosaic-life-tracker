# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1008 close WebKit gesture coverage gaps that are possible without real iPadOS or Appwrite.

## Boundary
- Live stable Preview base: `fix/ios-task-input-webkit-1008-20261019@46437537b9e7d1aacca03d2a5a4490bf46bac427` (v0.29.13); protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1`; protected `main@b952f71ecd2add3172f90104bc0e856a2648ccc9`. No approvals for dev/main promotion.
- Latest stable Preview canonical #39224425474 SUCCESS, trusted delivery #39224825886 SUCCESS and Vercel READY. Full Playwright correctness suite covered Chromium 63 passed, WebKit 43 passed, 20 explicitly skipped native-touch drags. Firefox #1009 remains post-1.0 planning.
- Task branch: `chatgpt/1008-webkit-trusted-taps-pointer-20261019`, based on accepted Preview. Internal test/docs work only, no app runtime/backend/version changes.

## Current work
- Upstream Playwright Touchscreen API has only `tap` (no trusted touch down/move/up; open upstream feature microsoft/playwright#39043). Synthetic touch events carry `isTrusted=false`, so do not misrepresent them as iPad Safari native swipe coverage or remove CDP-only WebKit skips.
- Task-entry iPad-sized browser test now uses genuine `locator.tap()` for category and outside-blank-space interactions, proving blur/save without invoking a keyboard Done key. Tests use `hasTouch: true` across both engines.
- Add complementary cross-engine trusted *mouse/pointer* tests for delayed sortable task activation and retained bottom sheet header dragging/dismissal. These test pointer handling, not native touch-drag parity.
- The 20 WebKit CDP-only drag skips remain explicit. No Appwrite-dependent tests or provider work in scope.

## Verification and handoff
- This task branch has not yet completed focused/browser CI at the checkpoint; do not claim it is green.
- Next: publish one coherent task commit with `[verify:browser]`; verify focused + Chromium/WebKit shards, repair any engine failures. Then squash to stable Preview, run full canonical and trusted Preview delivery. Leave #1008 open for real iPad Safari/PWA gesture and keyboard acceptance when Appwrite/device testing is possible. No dev/main promotion.
