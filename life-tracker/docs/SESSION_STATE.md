# Session checkpoint
Updated: 2026-10-23 Asia/Manila
Current task: #1245 opt-in nested-sheet performance measurement accuracy, following accepted v0.43.7 canonical CI.

## Verified baseline
- `dev@fcfd860c3bc4d975ab62ac5b6523ad3b206c03f6` v0.43.6 includes the owner-approved nested-sheet jitter fixes; `main@c938c825370f8270b46f19119b06a1f74d35842b` unchanged.
- Repaired stable `perf/1245-day-slide-prop-stability-v0437-20261022@8bfb96128eb919798150723a8cbf8fc838125242` v0.43.7 passed canonical Quality Gate #39811764621, including browser gesture/drag tests; PR #1260 removed the unsafe Diary memo adapter after an observed held cross-day drag regression.
- Trusted Preview Delivery #39812355460 attempt 3 was **waiting/queued** at latest read; Vercel had no exact-SHA v0.43.7 deployment. Do not claim READY until trusted receiver, deploy and Vercel exact SHA are verified. Issue #1262 tracks receiver API failures.

## Measurement correction
- Opt-in `tests/e2e/performance-probe.spec.mjs` recorded `reactProfile` **before** waiting for its full 700 ms animation sample. Move the snapshot after the 750 ms observation wait to include delayed commits.
- Keep the existing input-action long-animation-frame metric and add a separately named **700 ms animation window** LoAF count/maximum. Do not mislabel action-only LoAF as a complete transition measurement. Existing Event Timing observer already disconnects; no change required there.
- Diagnostic-only change; no Day View/BottomSheet runtime behavior, version bump, provider/backend, or CI thresholds. No performance gain or physical-device result is claimed.

## Delivery and next action
- Task branch `chatgpt/1245-perf-probe-animation-window-20261023` based on accepted stable `8bfb961`, with `[verify:focused]` for scoped checks.
- After focused green, squash into the existing stable Preview, obtain new full canonical acceptance, trusted exact-SHA Vercel READY, and only then perform matched synthetic/mobile measurements before any rendering optimization.
- Do not promote to dev/main or alter Production without separate approval. Keep #1245 open.
