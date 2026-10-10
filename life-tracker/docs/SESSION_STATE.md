# Session checkpoint

Updated: 2026-10-11
Current task: finish issue #406 approved Preview -> dev integration, deployment repair only (version impact NONE).

## State/evidence
- Integrated v0.16.6 stable Preview feature/shared-tasks-dev-integration SHA ab1c450f5614ac00e9af833bf2f5c237322adb4d passed canonical gate 38079683632 and Vercel READY.
- PR #547 merge into dev at 75c8aeaf3a7cafc4bf32cae77c06c81d488178d3 preserved exact accepted Preview tree 11f8d91d83666abe30e54a57769bd1316d2787ed. Main/Production unchanged.
- Vercel dev deployment dpl_3mGGfud88ZXiyfacZYnHRsqPfZQP failed **only** the aggregate raw-asset budget by 268 B. Its build compiled and passed PWA, entry, initial, Home and other budget checks. Vercel measurements: aggregate raw 2,391,268 B; gzip 737,674 B; precache 2,475,479 B. Preview build had lower aggregate byte totals.
- Adjust only measured aggregate ceilings to 2,393,000 B raw, 739,000 B gzip, 2,477,000 B precache. Keep entry, initial closure and Home closure ceilings unchanged. No app code, backend, dependency or version changes. Repo size-budget regression values aligned.
- Scratch Function/row schema already active and secure; account/grants data still Scratch only. Manual iOS/Android device acceptance not claimed.

## Next action
- Commit this scoped deployment-budget repair (and checkpoint) from accepted stable Preview as a task with [verify:focused].
- Squash into feature/shared-tasks-dev-integration; run full canonical CI and exact-SHA Preview Vercel readiness, then merge via PR into dev with identical tree and verify dev GitHub CI and Vercel READY/200. No main/Production promotion. Issue #406 stays open pending release.
