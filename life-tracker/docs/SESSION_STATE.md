# Session checkpoint

Updated: 2026-10-17 UTC
Task: #858 cached Home startup, Calendar-first. Diagnostic-only branch.

## Release boundary

- Stable Scratch Preview v0.29.6 `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4` remains accepted (canonical #39013268008 SUCCESS, Vercel #39013382108 READY). No dev/main/Production/Appwrite/1.0 authorization.
- Diagnostic branch `chatgpt/858-offline-online-pwa-20261017`: only synthetic browser labs, isolated Actions and checkpoint; no shipped app code or backend writes.

## Verified evidence

- Original 125-run Todo scale #39029949275 SUCCESS: cached SW online/offline nearly matching under synthetic held Appwrite; no statistical equivalence or real-session proof.
- Calendar-versus-Todo 60-run #39033417750 SUCCESS. Extended 84-run #39034283811 SUCCESS with text-only, same-day, UI-persisted 0–1000 tasks: 1000 online Calendar Home-ready p50 664ms vs Todo 2888ms, offline 666ms vs 2973ms (2× CPU Chromium). Longest main-thread tasks 68ms vs 1815ms. No improvement when suppressing native task image observations at 500/1000. Raw results in Actions and #858 comments; cross-run absolute timing varies.
- Calendar date-distribution #39035865412 SUCCESS (24/24): same 500 persisted task documents, slow-online Calendar Home-ready p50 827ms one day / 841ms seven days / 859ms thirty days / 741ms entirely outside mounted months. Thirty-day spread mounted 517 task blocks for 500 unique tasks (neighbor-grid overlap); the distant case mounted zero. Offline medians 863/862/861/792ms. No browser clock mutation. Regression #39035865398 SUCCESS.
- Focused #39035865365 failed **only** because previous checkpoint enlarged the fixed handoff above 3000 tokens. Keep checkpoint short; never weaken guard.

## Current diagnostic

- New Todo ablation uses `scripts/issue-858-ablate.mjs` to modify only ephemeral CI-runner source files before compiling a throwaway production bundle. Per browser context at fixed mount-time flag, compare 500/1000 same-day tasks: normal, no DnD registration, no Motion row layout, both disabled. Identical local snapshot, retained task components; 3 repeats per case. No-DnD intentionally breaks reorder only in synthetic diagnostic build, never deployed.
- Heavy 1000-task and distribution workflows are manual dispatch now; new `issue-858-todo-ablation-lab.yml` owns this push's independent performance experiment.

## Next action

- Verify new focused gate, independent startup regression and ablation lab. If failing, inspect logs, repair, rerun exact SHA. Publish raw causal A/B results to #858; choose a targeted runtime candidate only after evidence and preserve drag, keyboard, Diary, reordering and offline startup.
- Retain #858 OPEN for real authenticated Scratch sync, remote hydration, images, friend/shared, 401, cache eviction, multi-tab and actual Android/iOS installed PWA acceptance. #936 security/privacy and #914 backend compatibility are separate pre-1.0 gates.
