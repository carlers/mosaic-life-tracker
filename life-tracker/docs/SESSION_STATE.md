# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 slow-network local-data startup root-cause automation (owner approved).

## Protected baseline and bounds

- `dev@b0c703636c8c6e8d52c6dd3c59ebc0251070ab7e` v0.29.5 and `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` published v0.29.1 unchanged. No authorization to promote to dev/main or publish 1.0.
- Stable diagnostic Preview `perf/858-startup-diagnostics-20261017@32175b4bb4b515ebb007fbf70624623e386c306e` has full canonical green (#39011580584), trusted Preview deployment READY (#39011708956) and the registered independent alias. User reported slow **Mosaic — Opening your local data…** screen *before* Home.
- Existing marks confirm the splash can be caused by either DB bootstrap or a lazy AppDataShell module; pending Appwrite alone was proven nonblocking on a GitHub browser runner (browser test #39011443366). No evidence yet for the user's precise network environment.

## Work in progress: automated performance reproduction

- Isolated branch `chatgpt/858-slow-network-lab-20261017` starts from the exact stable Preview SHA. A dedicated branch-only GitHub Action builds an official-mode **Scratch-bound production output without credentials**, runs a production-output Playwright phone-viewport benchmark, and uploads a redacted report. This work is diagnostic tooling, no shipping UI/API/version changes.
- New lab compares fresh fast-JS startup with Appwrite held, throttled same-origin JS with Appwrite held, and real PWA precache warm reload under the same throttle. Records DB module/open/collections vs AppDataShell timing and slowest same-origin **code asset names only**. An isolated synthetic owner with no real rows is used; never consult Production or claim physical-device acceptance.
- If a measured code/download bottleneck exists, optimize only that source path without bypassing RxDB, 401/account isolation or user data. Fix lab CI errors, checkpoint the evidence in #858. The diagnostic workflow must not become a required global Quality Gate.

## Next action

- Let the branch-only `Issue 858 Slow-Startup Lab` Actions run complete, fetch actual per-scenario metrics, distinguish first-install from installed-PWA startup, and choose/verify a scoped implementation or record a concrete blocker. No owner instructions needed for baseline CI lab; manual device acceptance remains separate for any user-facing fix.
