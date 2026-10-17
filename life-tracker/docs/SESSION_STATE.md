# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 cached-owner offline/online cold-start verification (diagnostic only).

## Live baseline / boundary

- Stable Scratch Preview `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4` is v0.29.6; prior canonical #39013268008 SUCCESS and trusted Preview #39013382108 READY. No #858 dev/main/Production promotion or 1.0 release is authorized.
- The first uncached slow-online Home must fetch required JS: ~5.7 seconds under synthetic 220ms RTT/120kB/s throttling. SW-controlled fully precached launches avoid those transfers. Cached identity and local RxDB open do not explicitly await Appwrite.
- Current isolated diagnostic branch `chatgpt/858-offline-online-pwa-20261017`; no application runtime, Appwrite schema/Function, worker, credentials, or user data changes.

## Experiment

- Credential-free production-build Chromium lab #39026425044 SUCCESS. With identical controlling SW and synthetic cached identity: cached empty RxDB Home-ready p50 online held 700ms, offline 730ms, account 200 723ms, account 503 718ms (4 per condition).
- Independently seeded 24 real local tasks via UI, persisted 12 IndexedDB stores, then restored isolated profiles. First task visible p50 offline 1047ms, slow online held 1035ms, mocked account 200 1063ms, mocked 503 1082ms (4 per condition). Every mode displayed persisted task 001/024.
- Separate real headless Chromium process restarts using one disk-persisted installed SW/cache profile: median Home-ready 1027ms online and 1024ms offline; median process launch-to-ready 1514ms versus 1511ms (3 per condition).
- These small samples show no demonstrated meaningful parity penalty in the controlled cached-PWA state. They cannot establish a statistical SLA or prove authenticated populated live sync, device/OS startup, Safari/iOS/Samsung, cache eviction, or partial update behavior. Confirmed 401 intentionally ends cached access.

## Next action

- Verify the exact diagnostic task Quality Gate after this concise checkpoint and the full isolated lab; investigate and fix failures.
- Record the complete synthetic evidence in issue #858, keep it OPEN, and seek separate owner installed-PWA/Scratch account slow-link, offline, 401 and reconnect acceptance before claiming physical-device parity.
- Only then profile local RxDB subscription/query, Home render and main-thread bottlenecks; do not perform speculative runtime refactors or protected promotions. #936 security/privacy and #914 backend compatibility remain separate pre-1.0 gates.
