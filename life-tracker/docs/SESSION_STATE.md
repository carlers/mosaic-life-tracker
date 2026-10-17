# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 high-volume cached-owner network parity and local post-DB attribution.

## Release boundary

- Stable v0.29.6 Scratch Preview `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4` remains accepted by canonical #39013268008 and Vercel READY #39013382108. No dev/main/Production promotion or 1.0 release authorized.
- Experiment-only `chatgpt/858-offline-online-pwa-20261017`: test, read-only CI and checkpoint only, no runtime/auth/schema/SW/remote changes.

## Latest verified evidence

- Earlier controlled Chromium labs #39026425044 and #39026738253 SUCCESS; Quality Gate #39026738260 SUCCESS. Empty, 24-task, and separate Chromium process-restart cached-SW parity observed. Real devices/live synced accounts unverified.
- Task-count scale lab #39027756427 SUCCESS and exact task focused #39027756400 SUCCESS: 0/25/100/250/500 UI-created current-day tasks stored in Playwright IndexedDB; 3 samples each of SW-cached online/offline and uncached fast/slow asset loads (60 launches). Fully cached slow-online Home p50 869/964/1119/1511/2418ms vs cached offline 896/999/1166/1514/2439ms. The online-offline differences were 3–47ms, not a statistical equivalence claim.
- At 500 tasks, first cached task visible p50 ~2465ms online, ~2493ms offline; longest individual startup long task p50 1220/1171ms, compared with 164/170ms for zero tasks. DB collection setup stayed ~60ms; Home-ready minus database-ready rose from ~0.6s to ~1.9s. Isolate RxDB first query vs React render before changing runtime.
- Uncached slow JS: Home-ready p50 ~5.64–5.68s across counts, but first task visible p50 ~7.86s (25 tasks) to 8.92s (500), proving that data-ready mark alone does not represent first usable Todo content. Initial-asset cache misses remain intrinsically network dependent.

## Follow-up benchmark now requested

- Continue branch-only synthetic read-only lab with five samples per task tier per mode, adding synthetic account HTTP 200 (while all other Appwrite calls remain pending), exact IndexedDB persisted task-title count assertions, and `home:tasks-ready` vs `home:owner-data-ready` stage split to identify post-DB query vs render overhead. Job stores partial data if a tier fails. No physical-device assertion.
- Verify focused and separate diagnostic CI at exact SHA; investigate any failure and update #858 with coherent measured findings. Do not merge diagnostic work into stable Preview or ship speculative runtime improvements.
- Remaining device/Scratch authenticated real sync, remote-only 100–500 task hydration, 401/reconnect, cache eviction and app update paths remain separate gates. #936 security/privacy and #914 backend compatibility stay mandatory pre-1.0.
