# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1008 full WebKit browser correctness coverage and stable Preview acceptance repair.

## Boundary and source
- Stable Preview `fix/ios-task-input-webkit-1008-20261019@d3dab8a9128d20c45ae4bcc8b63e2227e421cdb0` (v0.29.13), via PRs #1012/#1014/#1016/#1018/#1020/#1021/#1022.
- Task repair branch `chatgpt/1008-webkit-mouse-route-stability-20261019` starts at that Preview SHA. Protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1`, `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged; no promotion approved.
- No product runtime, Appwrite/backend, CI YAML, security gate, or version changes. Appwrite outage prevents authenticated manual iPad Safari/PWA acceptance.

## Evidence and current work
- Full non-performance Playwright browser correctness suite now required in both Chromium and WebKit on the existing two shards; trusted iPad-sized `locator.tap()` task-entry tests, plus real mouse-pointer sortable task and retained sheet drag tests. Twenty Chromium CDP-native touch-drag tests remain WebKit skips; Playwright Touchscreen exposes no trusted touch-drag, so this does not prove real iOS Safari gestures.
- Latest task fix #1022 `720cdceb86baca6f6049493af2bbe5b72c221a4d` passed focused/browser CI #39229587746 and squash-merged. Stable Preview canonical #39230156364 FAIL: browser shard 1 WebKit had two intermittent tests; all other jobs, including browser shard 2 and DOM, passed. The trusted delivery status from another run is not exact canonical acceptance for this SHA.
- The WebKit mouse-pointer sheet test intermittently failed to dismiss in an emulated mobile input context. Repair uses an explicit desktop mouse/pointer browser context (both engines, narrow viewport) and verifies the sheet visibly follows the held pointer before asserting dismissal. Still not a touch-drag assertion.
- Chat route edge swipe briefly mounts old and new `data-testid=chat-path` nodes. Repair selects the exact destination `/messages` route while still requiring the Messages parent page to be visible; old route may remain during transition.

## Next step
- Initial task CI #39232557673 failed before running browser tests: string replacement in chat-scroll spec treated the JavaScript regex `$'` sequence as a replacement token, yielding an unterminated source string. Replaced from the exact stable Preview source using a replacement callback; verified the destination RegExp source line before committing. Re-run focused/browser checks on the fixed task SHA. Then confirm full canonical checks and exact SHA-bound trusted prebuilt READY on Vercel; do not promote `dev`/`main`. Keep issue #1008 open for real iPad Safari/PWA acceptance and unsupported native touch-drag coverage; post-1.0 Firefox #1009 remains planning only.
