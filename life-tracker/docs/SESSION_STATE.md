# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 slow-network Home startup structural A/B audit; no new product change justified.

## Verified branch and release boundaries

- Stable Scratch Preview `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4` ships v0.29.6: full canonical #39013268008 SUCCESS, trusted prebuilt READY #39013382108. Owner physical-device acceptance is pending. Do not promote to dev/main/1.0 without separate approval.
- Protected `dev@b0c703636c8c6e8d52c6dd3c59ebc0251070ab7e` is v0.29.5; `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` is v0.29.1. #936 security/privacy audit and #914 compatibility remain independent 1.0 gates.
- Isolated diagnostics `chatgpt/858-sw-first-install-ab-20261017` do not change committed runtime or deploy. All Appwrite requests in synthetic Chromium are held; Scratch client identity only.

## Measured diagnostic results

- Phase A [lab #39016028932](https://github.com/carlers/mosaic-life-tracker/actions/runs/39016028932) SUCCESS, first-install native SW registration A/B (3 samples each): immediate Home-ready median **5836ms** versus deferred-to-Home-ready **5725ms**; FCP 1924 vs 1928ms; full offline-ready 7468 vs 7552ms. Both reopened Home fully offline with 173 worker static requests. Second lab #39016426029 reproduced only ~57ms Home difference (5705 vs 5648ms); first paint was not better deferred. CDP worker request throttling may differ from page throttling. **Reject runtime SW scheduling change**.
- Phase B same-runner, two production builds in [lab #39016426029](https://github.com/carlers/mosaic-life-tracker/actions/runs/39016426029) SUCCESS. Baseline owner Home ready median 5649ms / Home FCP 1892ms / signed-out Login FCP 1872ms. Disposable auth-route lazy-split variant Home ready 5698ms / Home FCP 1860ms / Login FCP 2120ms; Home closure gzip 371402→369830B, with no usable Home gain and worse Login. **Reject auth-route runtime change**. No production code committed for either candidate.
- Both lab suites are credential-free and directional only, not physical-device field measurements. A separate baseline run found slow uncached Home ~5.7s vs controlled precached PWA ~0.7s; required JS downloads dominate rather than Appwrite verification or RxDB open.

## Next action

- Fix/verify the issue-858 experiment branch's documentation handoff-size regression (focused #39016426012 failed at 3129/3000 estimated tokens; browser shards passed). Add a durable issue checkpoint after green.
- Keep #858 OPEN for owner installed-PWA testing of already-READY v0.29.6; preserve all full precache, auth, local database and offline checks. Consider further bundle/request-waterfall analysis only if actual uncached startup remains material, with a separate evidence-based performance experiment before any shipped restructuring. No automatic dev/main/1.0 promotion.
