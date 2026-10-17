# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 independent local-data-volume scaling audit; diagnostic only.

## Baseline and boundaries

- v0.29.6 Scratch Preview stable `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4`: canonical #39013268008 SUCCESS, Preview #39013382108 READY. No `dev`/`main`/Production/1.0 approval.
- Synthetic full browser parity lab #39026425044 SUCCESS and focused checkpoint #39026738260 SUCCESS. Empty cached SW Home p50 700ms slow-online vs 730ms offline. 24 UI-created cached tasks first-visible p50 1035ms online vs 1047ms offline. Headless Chromium process restart Home p50 1027ms online vs 1024ms offline (n=3). No meaningful measured network penalty in these constrained cases; no statistical equivalence or physical-device proof.
- Uncached mandatory JS under 220ms RTT, 120kB/s remains ~5.7s Home; asset-cache miss is not task-cache miss. Confirmed 401 must revoke stale cached authority.

## Active scaling experiment

- Isolated `chatgpt/858-offline-online-pwa-20261017` adds a branch-only synthetic production-build lab, `tests/e2e/startup-task-volume.spec.mjs`, with 0/25/100/250/500 real UI-created same-day tasks persisted via RxDB/IndexedDB. Controls share category/Todo-view state.
- For each count, 3 interleaved samples of: SW-fully-cached slow-online, SW-cached fully offline, non-SW fast-online assets, and non-SW throttled-online assets. Record FCP, owner-Home ready, first/last cached task visible, module/DB/collection phases, Home-after-DB gap, browser long tasks, JS heap, code bytes and raw measurements. Check actual SW control, offline state and cached script transfers. A separate read-only Actions job archives partial and final reports.
- All Appwrite HTTP requests are intercepted and held; no real sessions, remote task hydration, Scratch/Production requests, or runtime/back-end changes. The 500-task single-day case is a deliberately heavy stress fixture. This cannot verify uncached remote-only tasks or actual sync concurrency; those require a separate safe synthetic backend or disposable Scratch acceptance.

## Next action

- Run exact task focused CI and isolated scaling lab; investigate fixture failures and repeat valid measurements. Record verified scale curves and optimization opportunities in issue #858 without treating diagnostic timing as a release SLA.
- Keep #858 OPEN pending real authenticated populated device tests, 401/reconnect, live-sync and cache-eviction cases. Do not promote v0.29.6 or change runtime on synthetic data alone; #936 and #914 remain independent launch gates.
