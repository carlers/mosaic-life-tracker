# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 test whether Home-adjacent Explore preload competes with owner calendar JS.

## Baseline and release boundary

- Stable Scratch Preview v0.29.6: perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4, full canonical #39013268008 SUCCESS, trusted READY #39013382108. No owner physical-device acceptance or approval for dev/main/1.0 promotion.
- Protected dev@b0c703636c8c6e8d52c6dd3c59ebc0251070ab7e is v0.29.5; main@b952f71ecd2add3172f90104bc0e856a2648ccc9 is v0.29.1. #936 security/privacy and #914 compatibility remain separate pre-1.0 gates.
- Synthetic slow uncached Home ~5.7s versus controlled PWA-cached repeat ~0.7s, with Appwrite held unresolved; RxDB opens in ~60ms and JS downloads dominate. Prior SW-install deferral A/B negligible with worse offline-ready time; Auth-route split worsened Login FCP. Neither was shipped. Previous exact-head focused/browser #39016753663 and lab #39016753657 SUCCESS.

## Current isolated diagnostic

- The AppLayout Home fallback mounts before database ready and schedules adjacent Explore code preloading from the Home route. Browser resource timings on the slow uncached load show SetUsernameSheet, BottomSheet and related Explore-only modules downloaded while Home is pending; causal cost not yet verified.
- CI-only experiment on chatgpt/858-sw-first-install-ab-20261017 builds the unchanged baseline and disposable candidate that skips Home-adjacent preload. Four fresh Chrome mobile/CPU 2x, 220ms RTT, 120kB/s samples for each, with Appwrite held. Compare Home-ready, first paint, pre-Home JS transfer and first Explore tap latency. The production source remains unchanged; no remote data or production access.

- Previous lab run #39020344430 failed its A/B-only first Explore DOM assertion: a synthetic account with no profile correctly shows the heading Set up your profile rather than Explore; normal slow-startup baseline and focused/browser gates passed. The repaired assertion accepts both legitimate page states; no runtime fix is involved.

## Next action

- Verify focused/browser task CI and the paired GitHub Actions slow-startup experiment at exact pushed SHA; fix any reproducible failures and record outcome on #858. If removing preloading speeds Home but harms first Explore navigation, investigate delaying the preload until Home is actionable rather than removing it permanently.
- Keep #858 open for owner installed-PWA slow-link and offline acceptance. Preserve full offline precache, local DB readiness, owner isolation and revoked-session protection. Do not promote to stable Preview/dev/main/1.0 from this diagnostic.
