# Session checkpoint
Updated: 2026-10-22 Asia/Manila
Current task: #1245 nested BottomSheet performance diagnostics and Diary exit lifetimes; v0.43.3 candidate, task branch only.

## Verified baseline
- `dev@ebbc9a1e01c4380af13ed2c913bed17fba905892` v0.43.2; no newer dev baseline at task creation. The previous #1221 checkpoint was stale and its feature is already promoted to dev.
- Historical #640 and #656 prove virtualization and resolved-component lazy warmup; don't regress them or infer present-day mobile latency from Chromium historical numbers.
- #858 remains open for cold-start work, separate from this nested sheet investigation. #700 architecture audit remains deferred.

## Authorized v0.43.3 candidate
- #1245: controlled `DiaryEntrySheet` and `DiaryReferenceSheet` opening/closing across owner/friend Day View, Diary and Chat quote callers, retained record through Framer exit, existing Back/focus/scroll and authorization gates preserved.
- Opt-in `@performance` nested two-layer BottomSheet benchmark built from real shared components, 50 synthetic task rows, cold/warm and blur/plain comparisons. Adds first frame where target DOM state is observed (not a guaranteed pixel paint); adds separate browser acceptance test for Diary exit and Escape.
- No speculative alteration of Day View reopen deferral, blur defaults, scaling, focus trap, global sheet registry, backend, or schema. Real device compositor performance and owner-acceptance remain unverified.
- Version files package.json/package-lock.json/appVersion.ts set to v0.43.3 in the same task tree.

## Delivery plan / next
- Task branch: `chatgpt/1245-nested-sheet-perf-diary-exit-20261022`, base dev SHA above, coherent task commit `[verify:browser]` to run focused plus browser contracts.
- Repair genuine CI failures, then create/reconcile stable Preview branch and verify exact-SHA canonical gate + Vercel Scratch Preview. Android/iOS device checks remain manual.
- Keep #1245 OPEN through manual acceptance. **No dev/main/Production promotion without explicit approval.**
