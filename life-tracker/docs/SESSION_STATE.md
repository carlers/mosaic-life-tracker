# Session checkpoint

Updated: 2026-10-05
Current task: Final polish and delivery of the build-vs-reuse refactor from stable Preview `refactor/build-vs-reuse-audit`.
Status: Source changes are complete on the polish task tree. The refactor now shares local push-checkpoint scanning across all six RxDB pilots; task/category/diary/settings additionally share owner-scoped Realtime→RESYNC and `$updatedAt + $id` tuple-paged pulls. Friendship/message keep custom pull/delete behavior because of cache and optimistic-intent side effects. Direct primitive tests cover checkpoint pagination, tuple query/checkpoint filtering, owner fail-closed behavior, and Realtime wakeups. The Dexie prototype remains reverted, and the lockfile experiment noise is removed. Audit/roadmap prose now records the final measured decisions instead of the original proposals.
Next action: Run one focused check on the complete polish diff, squash-merge it into `refactor/build-vs-reuse-audit`, require the stable branch's full canonical gate + exact-SHA Vercel Preview, then promote the accepted stable Preview tree to `dev` under the user's authorization. Do not promote to `main`.
Blockers: None known before CI. A physical two-device smoke is not claimed by automation and remains optional manual confidence, not a substitute for canonical verification.

## Final build-vs-reuse outcome

1. **Appwrite transaction CAS rejected.** Live disposable-project evidence showed a transactional read does not protect a later staged write from an intervening external update. The existing D1 owner-write race remains explicit; conditional `updateRows` would require a separate revision-token protocol.
2. **Replication deduplication accepted selectively.** All six pilots use `captureReplicationPushCheckpoint`. Task/category/diary/settings also use the shared owner tuple-pull and simple Realtime wakeup helpers. Friendship/message retain their side-effectful pull and delete handling. Lifecycle/start-stop and domain push/conflict/mapping policy remain local.
3. **Direct shared-helper regression coverage added.** The primitive contract now directly tests multi-page checkpoint capture, exact owner-scoped tuple query shape, malformed-row checkpoint filtering, owner rejection, and active-owner Realtime wakeups.
4. **Auxiliary IndexedDB reuse rejected.** The Dexie prototype passed build/size but added module-initialization IndexedDB coupling for modest source reduction, so native helpers remain.
5. **No further broad refactor planned.** Reopen only for a concrete correctness issue, maintenance fan-out, bundle evidence, or new product requirement.

## Verification evidence before this polish

- Initial implementation focused gate `37260886935`: success.
- Dexie-revert focused gate `37261486731`: success.
- Repaired stable full gate `37261563678`: success.
- Final tuple-pull extraction focused gate `37261803782`: success.
- Stable commit `e1fa366426ccde32ac3625bea71b5200798fd0fe`, full canonical gate `37261889776`: success across checks, production build/PWA/size, dependency audit, both DOM shards, and both browser shards.
- Exact-SHA Vercel deployment `dpl_7TPyaHa2SxRmnUQ4U8SrPvmeaKDA`: READY.

## Delivery boundary

The final polish should be one focused-verified task tree, then one stable-Preview full verification. Once accepted, promote that exact stable Preview tree to `dev`. No additional refactor batch is planned and no `main` promotion is authorized.
