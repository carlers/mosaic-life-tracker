# Session checkpoint

Updated: 2026-10-09
Current task: #409 — fix instant-closing sheets on Android Back/drag
Task branch: `chatgpt/sheet-exit-lifecycle-fix`, based on v0.6.0 accepted Preview `1d2ffc9e`.

## Root cause
- v0.6.0 initializes `childrenMounted` from `isOpen`, but never sets it true when an initially closed sheet opens. The subsequent Back/drag close therefore unmounts its portal immediately.
- Some feature-sheet owners also return null when task/message/friend state is cleared on close; Day View nested sheets and inline friend replies conditionally unmount.
- Fix shared presence arming, retain last opened entity to `onExitComplete`, keep affected owners mounted, and test both lifecycle and real-browser Back/drag dismissals.

## Verification and size-budget decision

- Focused CI `37893803369` passed. PR #429 squash Preview `409cce5b`.
- Canonical `37893958884`: both DOM shards, dependency audit and browser shard 2 passed; build failed only by 173 B in CI app-assets raw, Vercel by 337 B; all six other size metrics passed. The new browser drag test used a moving animation header and a mouse gesture rather than the supported CDP Android touch helper; checks also found this checkpoint lacked a machine-readable Next action field.
- Apply one measured **1,024-byte increase** to **only** `appAssetsRawBytes` max, 2,293,300 → 2,294,324 (0.045% of previous cap). The baseline remains unchanged; gzip, startup/Home and precache constraints are **not** relaxed. This acknowledges intentional shared lifecycle coverage rather than repeated byte-golfing or widening every size gate.
- Browser contract now waits for completed entrance and dispatches a real touch drag with the existing Playwright CDP strategy; keep timed Back and entity-clear tests.

Next action: verify the hook reopen regression on a task branch; squash passing task into the stable Preview and obtain a canonical CI + exact-SHA Vercel deployment. Keep dev/main unchanged.

## Delivery
- User-visible Preview repair: **v0.6.1**, with no theme/visual/backend/gesture-threshold changes.
- Focused CI, squash into stable `refactor/ui-behavior-standardization`, canonical CI, exact-SHA Vercel READY, issue update.
- Physical Android/PWA/iOS tests and theme visual review remain manual; `dev`/`main` unchanged without explicit approval.

## Subsequent acceptance findings

- Corrected candidate Preview `240fda82`, canonical CI `37894536501`: both browser-contract shards (including Android touch drag and Back/data-clear tests), both DOM shards, dependency audit and production build **passed**. Vercel deployment `dpl_781A27aFPen9xUcg6v5iUsWJJ8HE` **READY**; all seven size metrics passed.
- Only remaining failing check: `tests/unit/buildSizeGuard.test.ts` still pinned the previous exact raw-asset limit `2293300`. Align its reviewed limit assertion with `2294324` without changing any production code or budget again.

## Exact final-commit trigger recovery

- Preview `7081cfea` includes the accepted `buildSizeGuard.test.ts` assertion correction from [PR #431](https://github.com/carlers/mosaic-life-tracker/pull/431). However, no GitHub Actions push run or Vercel deployment appeared for that exact SHA after merging. Do not infer acceptance from previous run `37894536501`.
- Add regression coverage for data-backed sheet reopen after full exit. It checks that the old record survives while closing, clears after `onExitComplete`, and a different record appears on the next open.
- A new verified Preview SHA requires exact-SHA canonical acceptance and Vercel readiness; no version bump beyond v0.6.1 for test-only refinement.
