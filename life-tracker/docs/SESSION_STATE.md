# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1008 trusted WebKit tap and complementary pointer coverage, plus exact stable-Preview chat-scroll CI repair.

## Branch and authorization
- Protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` and `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged; no dev/main/production promotion authorized.
- Stable Preview `fix/ios-task-input-webkit-1008-20261019@0d6df83805565a62f5836fec832b208f4d3efaad` (version v0.29.13 unchanged). PR #1018 squash-merged into Preview; current repair task branch `chatgpt/1008-webkit-chat-scroll-settle-20261019`.
- Backend Appwrite outage means real iPad/PWA authenticated manual acceptance still pending. Internal tests/docs only, no runtime/backend/provider modifications.

## Changes and evidence
- Task branch #1018 focused/browser #39226567008 SUCCESS: Chromium 65 passed, WebKit 45 passed + 20 explicit Chromium-CDP native touch-drag skips.
- New tests use trusted `locator.tap()` for repeated task creation with iPad-sized viewport; complementary genuine browser mouse/pointer gesture regressions check task hold/drag activation and retained BottomSheet drag dismissal. These are not native iPad swipe equivalents. Playwright touchscreen API cannot currently issue trusted touch down/move/up.
- Stable Preview canonical #39227139684 FAILED only in browser shard 1, intermittent WebKit chat history scroll-to-bottom control after route switch; all other canonical jobs including browser shard 2 passed. Existing chat test waited for 80 messages but immediately set scrollTop while pending initial resize pin could override. Repair waits for scrollable content, settles the pending animation frames and asserts actual distance from bottom before requiring the button; never skips the test.
- No successful Preview acceptance or new trusted deployment at this SHA is claimed.

## Next action
- Commit focused browser repair `[verify:browser]`, confirm exact-SHA task CI and both WebKit shards. Squash repair to stable Preview only after focused+browser green, then require exact full canonical and trusted prebuilt READY delivery. Keep #1008 open for actual iPad Safari/PWA manual acceptance and 20 unsupported native-touch drag gaps; no dev/main promotion.
