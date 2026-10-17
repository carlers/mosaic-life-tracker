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

## Measured adjacent preload A/B

- Diagnostic head befde2c7e0321061cb5c598dc09481f42a453a38: lab #39020611789 SUCCESS, Quality Gate #39020611788 SUCCESS; issue checkpoint comment #6232246880. Four controlled slow JS samples each, Appwrite held: existing Home-ready median 5627ms, first Explore 151ms, 79 JS/456679 transfer bytes; no-Home-preload candidate Home 5513ms, first Explore 1913ms, 67 JS/439889 bytes. FCP 1868→1872ms. **Reject unconditional preload removal**: ~114ms gain on Home costs ~1762ms first Explore. No product runtime changed.

## Import graph follow-up

- Lab #39021033600 and Quality Gate #39021033656 SUCCESS at 36fd5c0a2614c915c9f288b72807d0e302a04c09. Read-only manifest report: bootstrap 146344 gzip bytes; Home static incremental 225058 (includes named database output 128432); shell static incremental 50017; required combined 421419 gzip bytes across 67 assets. Explore adds 12627 gzip bytes across 12 extra assets; filenames alone cannot establish which source module is removable.
- Vite/Rolldown did not expose a direct database source-root key despite the database chunk being in the Home closure. The graph tool now falls back to identifying its emitted output by filename. Static gzip sizes are not live HTTP transfer timings.

## Next action

- Verify the updated graph diagnostic and focused CI at exact new SHA, then record the checkpoint on #858. No safe high-impact startup refactor has been demonstrated; mandatory local database and bootstrap JS dominate. Avoid first-Explore regression and pre-1.0 architecture churn without stronger real-device data.
- Owner acceptance remains pending on the already-READY stable v0.29.6 Scratch Preview: installed PWA, slow network, offline reopening and subsequent reconnection. Keep #858 open and do not promote to dev/main/1.0 without separate authorization.
