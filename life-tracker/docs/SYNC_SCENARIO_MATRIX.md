# Sync scenario matrix

This matrix is the durable risk inventory for Mosaic's six RxDB replication pilots. It is
organized by failure mode/equivalence class rather than by every device permutation. A new sync
change should update the relevant row or add a row when it introduces a materially new state
transition.

Status meanings:

- **Covered** — current code plus an automated regression exercises the behavior.
- **Guarded** — current code has an explicit safety guard, but the exact combination does not yet
  have a dedicated regression.
- **Accepted** — deliberate limitation documented in `PROJECT_REFERENCE.md`; do not "fix" it
  without revisiting the trade-off.
- **Manual** — correctness depends on hosted/live behavior that unit tests cannot prove alone.

| Area | Scenario | Expected invariant | Status / evidence |
|---|---|---|---|
| Startup | Online account, all six pilots inactive | Start each pilot once; no legacy browser writer races normal RxDB resume | **Covered** — `sync.test.ts` direct six-pilot startup |
| Startup | All six pilots already active | Background trigger only requests pilot resync | **Covered** — active-pilot resync regression |
| Startup | Same-tab sync trigger arrives while coordinator is running | Coalesce and run one follow-up rather than overlapping writers | **Guarded** — coordinator queue flags; no dedicated stress regression for arbitrary trigger counts |
| Multi-tab | Two tabs try startup concurrently | Web Lock serializes compatibility/stale-recovery coordinator work | **Covered** — Web Lock startup regression |
| Multi-tab | Web Lock API exists but acquisition fails | Fail closed; never run compatibility coordinator unlocked | **Covered** |
| Multi-tab | Freshness request waits behind another tab too long | Abort at caller deadline and fail closed | **Covered** |
| Leadership | Safety-sensitive refresh runs in non-leader tab | Reject rather than claiming fresh local state | **Covered** in pilot freshness tests |
| Account switch | Owner changes during startup | Old generation stops; old-owner pilots are torn down | **Covered** |
| Account switch | Old-owner teardown runs after new owner schedules a backoff retry | Old owner must not cancel the new owner's wake timer | **Covered; fixed by this audit** |
| Shared local DB | Active account's upstream scan sees cached rows belonging to another account | Ignore local foreign-owner rows without touching Appwrite | **Covered** across pilots |
| Remote isolation | Owner-scoped list/get unexpectedly returns another account's row | Fail closed as a cross-account collision; never silently accept/filter it | **Covered; fixed by this audit** across all six steady-state pulls, stale-recovery/bootstrap snapshot reads, and owner-write direct master reads |
| Connectivity | Browser/Appwrite reachability is not proven | Do not start network sync; keep local app usable | **Covered** by connectivity/auth contracts |
| Reconnect/focus | App becomes visible/online/focused | Request resync immediately; do not depend on Realtime having delivered every event | **Covered** by AppLayout lifecycle + sync tests |
| Realtime | Create/update event arrives in order | Treat event as a wake-up and catch up through ordered pull checkpoint | **Covered; fixed by this audit** across all six pilots |
| Realtime | Reconnect misses an event, or events arrive out of order | Realtime must never advance the durable pull checkpoint directly; while visible+online, a periodic incremental resync bounds an otherwise silent missed-event gap | **Covered** — create/update emits `RESYNC`, lifecycle wake-ups remain immediate, and the 120-second watchdog has source-contract coverage |
| Realtime delete | Friendship/message hard delete event arrives | Soft-delete owner-scoped local cache and request a resync | **Covered** |
| Pull checkpoint | Multiple server rows share the same `$updatedAt` | Tuple checkpoint `$updatedAt + $id` must make ordering deterministic | **Covered** by query-shape tests |
| Pull response | Server row is malformed and lacks checkpoint fields | Do not advance checkpoint from that row | **Covered** — direct `replicationPilotPrimitives.test.ts` regression verifies malformed rows are filtered and cannot become the tuple checkpoint |
| Freshness | Initial replication has not completed | Do not persist a freshness timestamp | **Covered** |
| Freshness | Replication is canceled before initial completion | Do not persist freshness | **Covered** |
| Freshness | A retry/error cycle transitions `active → idle` but is not actually in sync | Do not refresh the 90-day safety timestamp until `awaitInSync()` proves convergence | **Covered; fixed by this audit** |
| Freshness | All six current replication identifiers have settled | Mark account data offline-ready | **Covered** |
| Freshness | Stored marker belongs to an older replication identifier | Reject marker as stale proof | **Covered** |
| Manual Sync Now | Six pilots converge at different speeds | Start all freshness proofs together under one deadline; report pending groups | **Covered** |
| Manual Sync Now | One pilot exceeds freshness deadline | Caller fails closed; UI clears spinner and reports background completion notice | **Covered** |
| Manual Sync Now | Local row content differs from Appwrite but the durable pull checkpoint is already past that row | After the first six-pilot freshness barrier, perform a full owner-scoped reconciliation and repair the local row even when application timestamps are equal | **Covered** — `sync.test.ts` same-timestamp drift regression |
| Manual Sync Now | Settled local owner row is absent from the complete server snapshot | Reconcile the local row to a Mosaic soft tombstone without treating checkpoint freshness as proof of equality | **Covered** |
| Manual Sync Now | Local owner edit lands while the full reconciliation is running | Do not overwrite that in-flight local edit; second freshness barrier resolves it through normal replication/conflict rules | **Covered** |
| Manual Sync Now | Messages contain newer local Function/outbox intent while the server snapshot is older | Keep message reconciliation conservative; preserve newer local intent and pending outgoing messages | **Guarded** by existing message stale-recovery/intent rules |
| Manual Sync Now | Local owner row already equals Appwrite | Do not rewrite it merely because a full scan was requested | **Covered** — avoids O(n) local write churn on healthy large accounts |
| Rate limit | Stale recovery receives HTTP 429 | Back off, retain error context, schedule owner-scoped retry | **Covered** |
| Transient failure | Non-429 stale recovery fails | Apply bounded failure backoff; do not start failed collection pilot | **Covered** |
| Stale client | Trusted collection freshness is older than 90 days | Full owner-scoped recovery pull before pilot start; recovery itself performs no Appwrite writes | **Covered** |
| Stale client | Full recovery page/row fails or cannot complete | Do not advance trusted pull boundary or start that pilot | **Covered** for row/rate-limit failure; page-cap/non-advancing cursor is **Guarded** |
| Stale client | Old clean local row is absent from complete remote snapshot | Convert local row to Mosaic soft tombstone | **Covered** |
| Stale client | Local edit happened after last trusted freshness | Preserve local edit for normal RxDB conflict handling | **Covered** |
| Stale client | Pending outgoing message is absent remotely | Preserve pending message; delivery/outbox still owns it | **Covered** |
| First sync | No assumed master; local equals remote | Acknowledge without rewriting Appwrite | **Covered** for owner-write pilots |
| First sync | No assumed master; remote is newer | Remote wins | **Covered** |
| First sync | No assumed master; local application timestamp is newer | Permit one owner write | **Covered** |
| TodoMate import | Large fresh task batch is the remaining cloud bottleneck | Count unique successful task sends from RxDB `sent$`; send each pristine RxDB push batch through the authenticated Function for concurrent API-key server creates; validate caller ownership/shape/permissions server-side; preserve returned existing-row bootstrap conflicts; fall back to the prior paced browser lane only when the deployed Function does not know the new action | **Covered** — task-pilot Function-batch/fallback/conflict regressions plus handler validation/concurrency/ownership regressions |
| Task conflict | Friend reaction changes server row while owner edits task | Merge server-owned reaction drift when owner fields did not change remotely | **Covered** |
| Settings side effect | Profile image setting write succeeds but profile mirror fails | Keep pending image so next reconciliation can repair side effect | **Covered** |
| Message intent | Pull races optimistic read/unsend/reaction state | Preserve only documented newer local Function/outbox intent; server-owned fields still win | **Covered** |
| Concurrent write | Another device changes the same task/category/diary/settings row after the client master read | The stale write must update zero rows and return the current master to RxDB instead of silently overwriting it | **Covered in code / rollout-gated** — 2026-10-06 scratch proof validated server `updateRows` CAS using `$id + $updatedAt`; handler/client/pilot regressions cover conflict return. Protection is active once the updated `message-action` Function is deployed; the old-Function compatibility fallback intentionally retains D1 only during staggered rollout. |
| Stale recovery clock | Client clock is severely skewed around the 90-day recovery boundary | Preserve uncertain local state conservatively | **Accepted** |
| Hosted socket behavior | Appwrite Realtime disconnects/reconnects under real mobile/PWA network changes | Focus/visibility/connectivity resync plus Realtime-as-wakeup must converge after network restoration; a continuously visible+online client requests incremental catch-up at least every 120 seconds | **Automated invariant + manual provider acceptance** — watchdog wiring is source-contract covered; real mobile/PWA socket timing remains a hosted/device check |

## Combination coverage

The matrix deliberately combines orthogonal dimensions instead of enumerating a Cartesian product
of every device/browser/account/network state. The high-risk combinations that require explicit
coverage are:

1. **owner change × in-flight async work** — account generation, pilot teardown, and retry timer
   ownership;
2. **multi-tab × freshness-sensitive operation** — Web Lock plus RxDB leader ownership;
3. **Realtime gap/reordering × durable checkpoint** — Realtime never advances the checkpoint
   directly;
4. **stale client × deletion retention × offline edit** — read-only full recovery plus conservative
   local preservation;
5. **shared local DB × account isolation** — local foreign rows are ignored, remote foreign rows
   fail closed;
6. **server-owned field × owner write** — task reactions and message/read semantics retain
   collection-specific merge rules.

The remaining accepted correctness risk in this matrix is client-clock ambiguity in rare stale recovery. The former owner-write D1 is now closed by Function-side compare-and-set once that backend revision is activated; the compatibility fallback is rollout-only and must not be mistaken for final production acceptance. Routine full anti-entropy remains deferred unless convergence testing shows a reproducible checkpoint divergence that the bounded incremental watchdog cannot repair.
