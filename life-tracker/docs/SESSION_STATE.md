# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1008 WebKit trusted tap and pointer-gesture coverage; repair exact stable Preview acceptance failures.

## Boundary
- Stable Preview `fix/ios-task-input-webkit-1008-20261019@f4fe09602b407e295eb85a7cf5996b5a986c346b` (v0.29.13 unchanged). Protected `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1`; `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` untouched, no promotion approval.
- Current task repair branch `chatgpt/1008-dom-auth-mock-stability-20261019` starts from the failed canonical stable Preview SHA. Internal test/doc-only revision, no app runtime or provider changes.
- Owner cannot test actual native iPad Safari/PWA while Appwrite is unavailable. Playwright WebKit low-level native touch-drag unsupported; 20 Chromium-CDP-only native swipe/drag tests remain explicit WebKit skips. Firefox #1009 remains post-1.0.

## Evidence and current work
- Task #1018 verified focused + browser [#39226567008](https://github.com/carlers/mosaic-life-tracker/actions/runs/39226567008) green (Chromium 65 passed, WebKit 45 passed + 20 intentional skips). Genuine `locator.tap()` now exercises iPad-sized new-task blur-save; complementary trusted mouse/pointer tests cover task hold sort and retained BottomSheet drag without claiming native touch parity.
- First stable canonical #39227139684 failed intermittent WebKit chat history button due pending ResizeObserver scroll pin. Repair PR #1020 passed focused/browser #39227853290 and was squash-merged into stable Preview `f4fe09602b407e295eb85a7cf5996b5a986c346b`.
- Full canonical #39228400105 failed DOM shard 1: `AuthProviderPostHog.test.tsx` `resets identity after successful logout` received undefined before logout because the one-use mocked account response was exhausted by an asynchronous auth lifecycle check. All tests in that shard otherwise passed; build, static and other DOM shard green. Separate repair uses a stable resolved account mock only in this logout test, retaining the user-id and PostHog identity assertions. The concurrent browser result must be checked before claiming it green.
- No successful canonical acceptance or new trusted Preview deployment for this SHA is asserted.

## Next safe action
- Commit this small fixture repair with `[verify:focused]`; inspect focused CI. Squash into stable Preview only when green, and check exact full canonical CI, trusted receiver and matching Vercel READY. Do not edit the protected-main-reviewed Quality Gate YAML or promote to dev/main without explicit approval. Keep issue #1008 open for native Safari/iPad testing and unsupported native touch-drag gesture coverage.
