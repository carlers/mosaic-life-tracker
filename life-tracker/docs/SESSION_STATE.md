# Session checkpoint

Updated: 2026-10-11
Current task: Existing task-photo recovery after confirmed v0.17.5 Preview acceptance.

## Objective and isolation
- User tested photo layout/cross-device Preview and confirmed it works, but asks that already-unavailable images recover and the completed fix merge to dev.
- Accepted stable Preview: `fix/task-photo-cross-device-render-20261011` at `05ecfd3`, v0.17.5; exact Vercel READY and full canonical CI succeeded.
- Follow-up task: `chatgpt/task-photo-cache-recovery-20261011` from accepted stable Preview, candidate v0.17.6. Keep main and Production Appwrite unchanged.
- Previously cached truncated/corrupt image blobs can survive a normal download fix: decoding failures now trigger one cache-bypassing remote retry, with a task-level Retry control for still-unavailable photos. Preserve original offline blob until successful replacement; do not erase all offline image caches.
- Genuine missing Appwrite Storage files cannot be recovered without bytes on an original device or an external backup. A Retry action cannot reconstruct missing originals.

## Next action
- Stable Preview `506033b` passes Vercel READY at exact Scratch backend and all seven measured size metrics; full GitHub quality gate run #38152266215 passed checks/unit/DOM/build and browser shard 2/2. Browser shard 1/2 failed twice in an existing Chat loading test because unscoped `getByRole('status')` matched the app global status plus chat skeleton; no photo code was involved. Narrow the two Chat-scroll assertions to the status containing `Loading messages`, verify the test and re-run full stable CI before the authorized dev promotion.
- Focused recovery task passed at `31e417e`; PR #623 squash-merged to stable Preview `e77c45f`. Full Vercel build rejected only narrow aggregate bundle budgets. Issue #624 records the exact measured, three-metric review and previous limits; recovery build uses scratch Appwrite and no Production writes.
- Review-only branch `chatgpt/task-photo-size-review-624` adds measured, metric-specific caps with unchanged historical baseline and other limits. After focused CI, squash into stable Preview and re-run full canonical CI plus Vercel READY before the approved dev promotion.
- Focused task CI then squash PR into the same stable Preview, full canonical CI and Vercel READY at exact SHA; user already authorizes dev promotion after adequate recovery.
- Before dev promotion verify exact SHA, version monotonicity, no source divergence, CI and Vercel scratch identity. Use a merge-commit stable Preview → dev PR with exact source tree; no main release approval.
- After merge, read back dev commit/checks/deployment and report remaining manual/device acceptance separately.
