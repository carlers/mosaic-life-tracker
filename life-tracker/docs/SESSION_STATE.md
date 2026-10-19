# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1004 complete permanent dogfood PWA and stabilize full acceptance.

## Exact refs and environment
- `feature/dogfood@45869b66a6f8d6fa7e97eb2c1e82298274875368`, `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` (v0.29.12), and `main@b952f71ecd2add3172f90104bc0e856a2648ccc9`. No dev/main/Production promotion.
- Stable installed-testing origin `https://mosaic-life-tracker-dogfood-carls-projects-72516fde.vercel.app` points to verified first accepted Preview `dpl_2YSk2g6uShRVmxWggXQxfZsmRm37`, not to a pending/failed build.

## Accepted source and cloud
- First dogfood acceptance Quality Gate #39215632119 SUCCESS on SHA `e3327131546b1d4a9fe3a34f74968864ef871eb4`; protected-main trusted prebuilt #39215830876 SUCCESS. Alias assigned and read back. Appwrite Scratch active, existing `*.vercel.app` Web platform; exact origin addition 403 due Free plan's platform quota; no provider settings weakened.
- Follow-up runbook PR #1010 squash-merged as `45869b66...`, task focused #39216446674 SUCCESS. Canonical #39216585776 attempt 1 and failed-job retry attempt 2 both failed exactly one DOM test in `PersonPaneViewSwitcher.test.tsx`: friend pane React.lazy did not load before the default 1s query timeout; body still only contained Suspense fallback. Browser, build, other DOM, checks and audit jobs succeeded. The same app/test code passed canonical #39215632119 before documentation-only changes.

## Fix in current task branch
- `chatgpt/1004-friend-lazy-ci-stability-20261019` preloads the **real** FriendPersonPane module specifically in its view/date behavior test, removing unrelated import-timing contention while keeping genuine friend switching assertions. No runtime behavior changes, version impact NONE.

## Next
- Commit coherent task requesting `[verify:focused]`; after green, squash into `feature/dogfood` and require full canonical success and default-main trusted writer READY. Move same alias only after exact-SHA acceptance/readback; verify alias points to second accepted Preview.
- User device acceptance of PWA login, local data persistence, offline reopen, Update now and rejected-feature rollback remains separate. Do not claim it or bypass gates.
