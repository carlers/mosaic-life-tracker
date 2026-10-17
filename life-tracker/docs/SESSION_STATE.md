# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 repair populated IndexedDB browser fixture after timeout (no runtime changes).

## Live baseline / boundary

- Stable `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4`: v0.29.6, full canonical Quality Gate #39013268008 SUCCESS, trusted Scratch Preview #39013382108 READY. Dev remains v0.29.5, Production main v0.29.1. No dev/main/1.0 promotion approved.
- Owner's long pre-Home "Opening your local data…" splash was reproduced with Appwrite permanently unresolved. Under a slow uncached site asset connection Home owner data took ~5.7s; under a previously installed, controlled SW cache ~0.65–0.70s. Those two differ in **asset-cache state**, not online/offline network state.
- Previous structural tests rejected initial SW registration deferral, lazy Auth routes, and unconditional removal of adjacent Explore preload due to negligible Home gains or other regressions. Do not ship speculative import/bundle changes on these findings.

## Experiment

- New production-output browser experiment seeds 24 owner tasks through the app UI and captures IndexedDB/localStorage for controlled SW-cached reloads, comparing offline, hung Appwrite, mocked 200, and mocked 503. This addresses synthetic empty-data limitations without introducing test backdoors or real account access. A missing/corrupted SW cache and real device remain separate unverified conditions.

- Extend the same isolated production-output lab to interleave cached offline and hung-online controls with two synthetic Appwrite account outcomes: immediate valid cached-owner 200 and HTTP 503. All other provider requests remain held. Capture Home readiness and prove the account response actually happened. This investigates whether connectivity-to-online can start background modules early enough to compete with Home; it is not real authenticated backend/sync validation.

- Isolated `chatgpt/858-offline-online-pwa-20261017` changes only the credential-free production-output Chromium diagnostic, enabling **same installed/controlled precache state** in slow-online and fully offline reload conditions with Appwrite requests held unresolved. It records FCP, local owner Home readiness, DB and shell marks, cache transfer, and navigator online status; four interleaved samples per condition, plus existing uncached controls.
- No app runtime, schema, worker, Vercel, Appwrite project, or customer data changes. This is a synthetic owner with empty local RxDB on Chromium, not a real device, authenticated Scratch account or cold process.

## Next action

- Fourth lab #39025693747 reached active Todo category pill but `.first().click()` targeted an offscreen duplicated Swiper pill. Fixture now resolves the nearest Day View slide's aria-hidden attribute and invokes the real button handler without pointer hit-testing. Rerun independent performance lab and focused/browser CI; do not treat this Playwright locator error as a Home performance regression.
- Third lab #39025462740 failed before fixture task creation: deliberate immediate Appwrite abort showed the offline status banner on top of the menu and intercepted pointer clicks. Hold requests unresolved during fixture creation instead, then release on cleanup. Add a seeded-task visibility timestamp distinct from Home owner-data mark; verify next isolated lab and Quality Gate.
- Second lab #39025200150 exposed the fixture defect: category created, but Home remained in its default Calendar mode with no task-category pill. Explicitly select Todo and persist the synthetic test profile's `mosaic_home_view=todo` before seeding; verify the next dedicated run. This is not a product issue.
- First seeded-fixture CI #39024433162 failed after 500s without a completed fixture; earlier empty-cache case passed. Narrow active Swiper selection and emit stage progress/Playwright error context for causal diagnosis; do not misreport timeout as an app performance regression.
- Verify the seeded IndexedDB production browser lab and exact task SHA focused/browser Quality Gate; repair root causes of failures. Compare 200/503 outcomes against the cached offline/hung baseline and flag CPU contention without attributing small sample variance. Report direct offline/online results with uncertainty and do not infer causation from uncached comparisons. #858 remains OPEN for owner installed-device/offline acceptance; #936 privacy audit and #914 compatibility gate remain separate mandatory pre-1.0 work. No protected-branch promotion without explicit approval.
