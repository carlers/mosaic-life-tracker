# Session checkpoint

Updated: 2026-10-05
Current task: Connector write-batching workflow hardening on stable Preview `refactor/connector-write-batching`.
Status: UI smoothness Preview `d5371750f49467f7726e8ac57542241e220a020e` was promoted unchanged to `dev` by PR #286 as merge commit `ffac3b119672fdf1eebf538d618d240471aae6fa`; the dev promotion check and canonical acceptance passed by reusing the accepted Preview evidence. Connector investigation isolated the earlier large-patch failure: the current Code Mode harness accepts 20 nested connector calls in one execution and rejects 21, while no remaining-call counter is exposed. Public OpenAI API docs show the host can configure `max_tool_calls`, so the exact ceiling is environment-specific. The workflow docs now require a conservative <=12-call preflight, separate read/write phases, <=12-call blob batches, and a final 3-call tree/commit/ref phase. A lease-shaped `update_ref` attempt also exposed an action-argument compatibility quirk, so the protocol now requires a fresh head read and uses an expected-head lease only when the current connector accepts it.
Next action: Focused-verify this documentation-only task commit, squash it into `refactor/connector-write-batching`, then require the stable Preview canonical gate/delivery. Do not promote this refactor to `dev` or `main` without explicit user instruction.
Blockers: None.

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
