# Session checkpoint

Updated: 2026-10-05
Current task: Finish the build-vs-reuse implementation on stable Preview `refactor/build-vs-reuse-audit`; `chatgpt/refactor-pull-primitive` contains the final low-risk replication primitive extraction.
Status: R1 Appwrite transaction CAS was rejected by live disposable-project evidence. R2 is now scoped to three high-confidence owner-write primitives shared by task/category/diary/settings: push-checkpoint capture, owner-scoped Realtime→RESYNC, and owner-scoped `$updatedAt + $id` tuple-paged pulls. Collection push/conflict/mapping behavior remains explicit. A larger lifecycle/controller abstraction was reviewed and rejected because it would replace duplicated straightforward state with a generic typed configuration/controller surface rather than materially reduce maintenance complexity. R3 direct Dexie reuse was rejected after the prototype passed build/size but failed the existing pending-image DOM isolation contract and would require extra dependency-injection/test plumbing for modest source savings; native auxiliary IndexedDB remains.
Next action: Run focused verification for the tuple-pull extraction. If green, squash into `refactor/build-vs-reuse-audit`, then require one final full canonical gate and exact-tree Vercel Preview.
Blockers: None known before CI.

## Accepted implementation

1. **No Appwrite transaction migration.** Live proof showed read→external update→stage→commit can still overwrite the external writer. Existing D1 remains explicit.
2. **Conditional `updateRows` CAS remains deferred.** It works with a revision predicate, but a safe adoption requires a new collision-safe remote revision token/schema protocol.
3. **Shared owner-write primitives:** `replicationPilotPrimitives.ts` owns:
   - local RxDB push-checkpoint scanning;
   - owner-scoped Realtime create/update/delete wakeups;
   - owner-scoped ordered tuple pull queries, owner validation, row filtering, mapping, and checkpoint construction.
4. **Keep lifecycle/domain policy explicit.** Start/stop/refresh state remains in each pilot. Push comparisons, first-sync behavior, strict create fallback, task images, settings profile work, mappings, and error labels remain collection-local.
5. **Keep native auxiliary IndexedDB.** Direct Dexie was measured and reverted; no `idb` fallback is justified without a new need.

## Verification evidence

- Initial implementation focused gate `37260886935`: success.
- Stable full gate `37261263767`: failed only the Dexie pending-image DOM contract; production build/size and other completed jobs passed.
- Dexie-revert focused gate `37261486731`: success.
- Repaired stable commit `d9c2a7542b56d375e05bc9173ab4f65451ef62c4`, full canonical gate `37261563678`: success across checks, build/PWA/size, dependency audit, both DOM shards, and both browser shards.

## Acceptance path

1. This final extraction checkpoint requests `[verify:focused]`.
2. Focused-green PR is squash-merged into `refactor/build-vs-reuse-audit`.
3. Stable Preview runs one final full canonical acceptance and Vercel Preview for the exact tree.
4. No promotion to `dev` or `main` without explicit user instruction.
