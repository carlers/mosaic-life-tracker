# Session checkpoint

Updated: 2026-10-06
Current task: Repair historical local replica drift that incremental RxDB checkpoints can hide, without making normal background sync expensive.
Status: Implementation is on `chatgpt/fix-sync-reconciliation`, based on accepted stable Preview `fix/sync-convergence`. A real two-device account reproduced the gap: Appwrite/server truth was correct, a fresh browser origin rebuilt correctly, but an older laptop replica stayed divergent while Sync Now reported success because its durable checkpoint had already advanced past the differing rows. Clearing local data fixed it only because that deleted both the stale local rows and the checkpoint. Manual Sync Now now settles all six pilots, performs a bounded owner-scoped full reconciliation, then settles the pilots again before stamping success. Automatic focus/reconnect/watchdog sync remains incremental.
Next action: Run focused verification for the final reconciliation tree, squash into `fix/sync-convergence`, require canonical full CI + Vercel Preview acceptance, then perform disposable two-device manual acceptance. Production Function activation and `dev` promotion remain explicit rollout steps.
Blockers: Vercel Preview still points at the production Appwrite project unless branch-specific environment overrides are configured. Production `message-action` has not yet activated the CAS revision, so Preview can test reconciliation now but not the final production CAS path until backend rollout.

## Completed evidence

- Reproduced checkpoint-hidden drift in real usage: ordinary Sync Now could report settled while one browser's local RxDB content differed from Appwrite; a fresh origin converged because it had no stale checkpoint.
- Preserved the existing cheap automatic path: focus/online/visibility and the 120-second watchdog still request incremental RxDB resync only.
- Changed explicit Sync Now into a three-stage barrier: settle pilots → full read-only reconciliation → settle pilots again.
- Owner-write collections (tasks/categories/diary/settings) and friendship cache treat the server snapshot as authoritative only after the first freshness barrier; rows changed locally during reconciliation are preserved for the second pilot pass.
- Message reconciliation remains conservative: full scan repairs older server-backed drift but preserves newer local Function/outbox intent and pending outgoing messages.
- Missing settled local owner rows are reconciled to Mosaic soft tombstones; incomplete/page-failed reconciliation fails closed and does not report a successful manual sync.
- Reconciliation skips owner rows whose mapped local state already equals Appwrite, avoiding pointless rewrites on large accounts.
- Removed legacy `reconciledMissingRows` persistence that had no read-side behavioral consumer, offsetting bundle cost without changing sync semantics.
- Initial focused verification for the core implementation passed; final focused/canonical acceptance remains.

## Working files

- `src/db/sync.ts`
- `src/lib/friendshipSync.ts`
- `tests/unit/sync.test.ts`
- `tests/unit/friendshipSync.test.ts`
- `docs/SYNC_SCENARIO_MATRIX.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/PLAN.md`
