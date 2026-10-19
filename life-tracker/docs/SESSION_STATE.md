# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1008 WebKit/iPad browser coverage and deterministic canonical acceptance without Appwrite.

## Boundary
- Stable Preview `fix/ios-task-input-webkit-1008-20261019@b91e086afc7d1a7f76c43901f9b90aee416ed3e2` v0.29.13. Protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` and `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged; no promotion approval.
- Task branch `chatgpt/1008-webkit-chat-scroll-intent-20261019`, pure browser-test/checkpoint repair, no provider writes, protected workflow modification, product runtime or version change.
- Appwrite unavailable; native iPad Safari/PWA authenticated verification pending.

## Product/browser coverage delivered in earlier branches
- #1008 previously established full Playwright correctness suite under Chromium and WebKit on both canonical shards.
- #1018 trusted touch `locator.tap()` on the iPad-sized new-task creation/blur/save flow; supplementary genuine mouse-pointer tests for sortable task activation and retained BottomSheet header drag. Task CI #39226567008 SUCCESS: Chromium 65 passed; WebKit 45 passed, 20 intentional Chromium-CDP-native touch-drag skips. These pointer tests do not replace native iPad touch swipes.
- #1020 chat scrolling test first fixed message-load race, focused+browser CI #39227853290 SUCCESS; #1021 fixed unrelated AuthProvider/PostHog one-use mock exhaustion, focused CI #39228827818 SUCCESS.
- Stable Preview canonical #39229014650 had both DOM shards green and build/checks green, but WebKit browser shard 1 again failed the chat `readHistory` helper: browser ended at gap 0 despite frame settling. The test was changing scrollTop without marking scroll-up intent, so the app's delayed bottom pin could override it.

## Current repair
- `readHistory` now waits for genuine bottom position, dispatches a synthetic upward `wheel` *solely as an app-level scroll-intent signal* (not claimed as trusted touch), then sets `scrollTop`. The hook's wheel handler cancels its pending pin before the scroll move; retain >300px distance and visible jump-button assertions. This is narrower than modifying app runtime or disabling the WebKit test.
- Playwright Touchscreen API currently supports genuine taps but no trusted touch drag. Existing 20 native-drag WebKit skips remain explicit. Actual iPad/Safari keyboard/PWA acceptance is a separate manual requirement.

## Next safe action
- Commit with `[verify:browser]`, inspect focused and both browser jobs. If successful, squash into stable Preview and inspect full canonical plus trusted SHA-bound prebuilt READY delivery. Issue #1008 stays open until actual iPad acceptance and touch gesture limitations are resolved; no dev/main promotion.
