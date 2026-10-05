# Session checkpoint

Updated: 2026-10-05
Current task: Implement the accepted build-vs-reuse follow-up on `chatgpt/refactor-existing-capabilities`, targeting stable Preview `refactor/build-vs-reuse-audit`.
Status: R1 transaction CAS was rejected after a live disposable-Appwrite proof: a transactional get followed by an external row update did not make commit conflict when the staged update happened after the external write, so transactions do not close Mosaic's read→compare→write window. A second live proof confirmed Appwrite conflicts only when the external change occurs after the transaction has staged an operation. Query-conditioned `updateRows` can behave as CAS, but using it safely would require a dedicated remote revision token/schema protocol, which is outside this reuse refactor. R2 now extracts shared push-checkpoint capture and owner-scoped Realtime→RESYNC mechanics into `replicationPilotPrimitives.ts` for task/category/diary/settings while preserving each pilot's push/conflict policy. R3 declares the already-resolved Dexie 4.4.2 directly and prototypes `pendingImages.ts` on Dexie with the same database/store/version and owner checks; full stable-Preview build metrics decide whether it stays.
Next action: Run focused verification on this task SHA. If green, squash into `refactor/build-vs-reuse-audit`; its full canonical build/PWA/size gate is the Dexie bundle decision. If build/static closure regresses materially or tests expose IndexedDB compatibility issues, revert the Dexie prototype while retaining R1 evidence and R2 primitives.
Blockers: None known before CI.

## Implementation decisions

1. **R1 killed by evidence:** Appwrite transaction reads are not sufficient CAS fences for Mosaic. Do not migrate the owner-write pilots to transactions.
2. **Conditional bulk update deferred:** `updateRows` with `$id + revision` predicates was live-proven to update one matching row and then return zero rows after the revision changed, but Mosaic has no collision-safe remote revision token today. Do not add one solely for this refactor.
3. **R2 small primitives only:** shared checkpoint capture and owner-scoped Realtime wakeup were extracted across the four owner-write pilots. Domain mapping, state equality, create/update behavior, image/profile side effects, and conflict policy remain explicit.
4. **R3 measured prototype:** `pendingImages.ts` now uses direct Dexie 4.4.2 while preserving DB name `mosaic_pending_images`, schema version 1, store `images`, owner filtering, local IDs, per-owner clearing, and test reset behavior. Friend/image caches remain native until the prototype passes bundle/runtime acceptance.

## Live Appwrite proof

Disposable project: `My first project`; temporary probe table is no longer present.

- Transaction A read row at revision 0; B updated row to revision 1; A then staged revision 2 and committed. **Commit succeeded and A overwrote B.**
- Transaction A read and staged its update first; B then updated the same row; A commit returned HTTP 409 `transaction_conflict` and B remained master.
- Query-conditioned `updateRows` with predicates `$id=row_cas AND revision=0` updated exactly one row the first time; repeating the same predicate after revision advanced returned `total: 0`.

These results supersede the audit's earlier assumption that a transactional read alone would protect the later write.

## Acceptance path

1. This final task commit requests `[verify:focused]`.
2. Focused-green task PR is squash-merged into `refactor/build-vs-reuse-audit`.
3. Stable Preview runs full canonical acceptance, production build/PWA/size checks, and Vercel Preview.
4. Dexie remains only if those metrics/tests are acceptable; otherwise repair on a child task branch and repeat.
