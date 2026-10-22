# Session checkpoint
Updated: 2026-10-23 Asia/Manila
Current task: #1245 opt-in nested-sheet performance measurement accuracy, following accepted v0.43.7 canonical CI.

## Verified baseline
- `dev@fcfd860c3bc4d975ab62ac5b6523ad3b206c03f6` v0.43.6 includes the owner-approved nested-sheet jitter fixes; `main@c938c825370f8270b46f19119b06a1f74d35842b` unchanged.
- Repaired stable `perf/1245-day-slide-prop-stability-v0437-20261022@8bfb96128eb919798150723a8cbf8fc838125242` v0.43.7 passed canonical Quality Gate #39811764621, including browser gesture/drag tests; PR #1260 removed the unsafe Diary memo adapter after an observed held cross-day drag regression.
- Trusted Preview Delivery #39812355460 attempt 3 **FAILED**: trusted receiver succeeded, but protected prebuilt deploy rejected latest exact-SHA CI/branch evidence. Vercel has no exact-SHA v0.43.7 READY deployment. Do not claim READY until trusted receiver, deploy and Vercel exact SHA are verified. Issue #1262 tracks receiver API failures.

## Measurement correction
- Opt-in `tests/e2e/performance-probe.spec.mjs` recorded `reactProfile` **before** waiting for its full 700 ms animation sample. Move the snapshot after the 750 ms observation wait to include delayed commits.
- Preserve the input-action long-animation-frame metric and separately report 700 ms animation-window LoAF count/maximum; include React commit timestamps. Existing Event Timing observer already disconnects correctly.
- Measure standalone Task Actions close/reopen separately from the Add Photo transfer (which also closes Task Actions), so exit and overlapping transitions are not conflated.
- Diagnostic-only change; no Day View/BottomSheet runtime behavior, version bump, provider/backend, or CI thresholds. No performance gain or physical-device result is claimed.

## Delivery and next action
- Task branch `chatgpt/1245-perf-probe-animation-window-20261023` based on accepted stable `8bfb961`, with `[verify:focused]` for scoped checks. Its first two meaningful commits produced **no Quality Gate run or check-runs** despite workflow push filters; no focused CI result can be claimed.
- After focused green, squash into the existing stable Preview, obtain new full canonical acceptance, trusted exact-SHA Vercel READY, and only then perform matched synthetic/mobile measurements before any rendering optimization.
- Do not promote to dev/main or alter Production without separate approval. Keep #1245 open.
