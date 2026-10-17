# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 cached-owner network parity and task-count scalability diagnostics; runtime unchanged.

## Release boundary

- Stable v0.29.6 Scratch Preview `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4`: canonical #39013268008 SUCCESS, Vercel #39013382108 READY. No dev/main/Production/1.0 authorization.
- Isolated diagnostic `chatgpt/858-offline-online-pwa-20261017` modifies only branch-scoped Playwright labs, read-only GitHub Actions and this checkpoint. No real Appwrite requests, sessions or data.

## Verified evidence

- Prior empty/24-task/cache-vs-offline and fresh Chromium process labs: #39026425044 and #39026738253 SUCCESS. All cached JS transferred zero network bytes.
- First scale task `d6f486a58ef1161c061a41e78b19fbec62c58e3c`: focused #39027756400 SUCCESS, independent scaling lab #39027756427 SUCCESS (60 launches). Five 0/25/100/250/500 task tiers generated through actual UI; IndexedDB reused; slow-online cached and offline startup were within 3–47ms p50 at n=3. Uncached slow script assets delayed Home ~5.7s; at 500 tasks first task only visible ~8.9s.
- Expanded diagnostic `2f6daf18c3e610b52987dde183ee2c6d787dc6bc`: scaling #39028694839 SUCCESS (125/125 launches, 5 per tier/mode; exact persisted task count verified), existing startup lab #39028694835 SUCCESS. Cached PWA slow-online Home p50 892/1002/1145/1616/2512ms (0/25/100/250/500), offline 911/1016/1201/1677/2448ms, synthetic account 200 893/1022/1172/1586/2544ms. This indicates no major network-response wait in tested cached-owner browser cases, not statistical equivalence, real auth or full server sync.
- Crucial post-DB attribution in cached slow-online: first tasks query after DB-ready p50 514ms at 0 tasks, 657ms at 500; first tasks query to Home-ready p50 64ms at 0 tasks, 1250ms at 500. One large startup main-thread task ~1.2s at 500 tasks. Diagnose Home/React rendering and possibly category/task derived calculations before altering RxDB.
- #39028694800 focused CI FAILED only due missing required `## Next action` heading in this checkpoint. Corrected in current repair commit; rerun focused. Do not label this a runtime failure.

## Next action

- Verify corrected focused Quality Gate and independent scale regression at exact task SHA; repair any failures. Save verified results to issue #858 and retain raw artifacts in Actions.
- Keep #858 OPEN pending physical installed-PWA, actual authenticated Scratch sync with 100–500 remote-only tasks, true 401/reconnect, cache eviction, iOS and multi-tab evidence. Tests use Chromium, 2x CPU, 220ms RTT/120kB/s, one-day one-category stress fixtures; Appwrite account 200 is synthetic, all other requests held.
- No speculative runtime edits or protected promotions. #936 security/privacy and #914 compatibility remain separate pre-1.0 gates.
