# Session checkpoint

Updated: 2026-10-05
Current task: Audit Mosaic's hand-built infrastructure against maintained libraries, framework capabilities, and platform features on `chatgpt/build-vs-reuse-audit`, targeting stable Preview `refactor/build-vs-reuse-audit`.
Status: Audit complete with no runtime changes. The codebase already delegates most commodity concerns appropriately. The highest-value reuse opportunity is Appwrite TablesDB transactions for the owner-write replication read→compare→write race: the installed browser SDK already exposes transaction-capable row operations, Appwrite documents commit-time conflict detection, and Mosaic already uses the same transaction pattern in trusted friendship code. This remains a proof candidate, not an accepted sync-contract change. The six RxDB pilots also contain substantial repeated adapter mechanics suitable for an internal shared TablesDB replication harness. A measured `idb` evaluation is the only new-library adoption currently recommended.
Next action: Run focused verification for this documentation-only audit. If green, squash the task PR into `refactor/build-vs-reuse-audit`, then require the stable branch's full canonical acceptance and Vercel Preview. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None known before CI.

## Audit decisions

1. **P0 — Appwrite transaction CAS proof:** prototype transaction-scoped remote read/compare/staged write/commit for one simple owner-write pilot. Require a deterministic two-client race proving that a concurrent external row change causes commit conflict and is translated back to RxDB as current-master conflict state.
2. **P1 — shared replication harness:** extract only invariant lifecycle, tuple-paged pull, owner validation, Realtime `RESYNC`, local checkpoint capture, freshness, and teardown mechanics from the six pilots. Keep task/settings image/profile work, message intent merging, friendship cache handling, and collection-specific conflict/write policy explicit.
3. **P2 — raw IndexedDB boilerplate:** evaluate `idb` for `pendingImages.ts`, `friendCache.ts`, and `imageCache.ts` with before/after bundle and source-size measurements; do not change TTL/LRU/ownership policy.
4. **Do not replace the sync stack:** RxDB remains the correct local-first engine for the current Appwrite backend. The official RxDB Appwrite plugin currently targets Appwrite's document/collection API rather than Mosaic's TablesDB row/table API, while PowerSync/Electric/Replicache would require larger storage/backend/protocol migrations.
5. **Keep specialized custom layers:** semantic outbox, PWA lifecycle wrapper, BottomSheet/Back-stack arbitration, focus trap, connectivity model, route/message gesture helpers, and the deliberately minimal PostHog HTTP adapter encode Mosaic-specific contracts or existing bundle/privacy decisions.
6. **Do not consolidate Embla/Swiper without measured evidence:** they currently own different accepted interaction surfaces with dedicated regression coverage.
7. **Appwrite-generated types are deferred:** Appwrite CLI generation reads `appwrite.json`; Mosaic currently treats `infrastructure/mosaic-backend.mjs` as its portable backend source. A second independently maintained schema representation would increase drift risk.

## Evidence

- Baseline audited: `dev` `c0e4a62`.
- `src/db/sync.ts`: 1,452 lines / ~42.9 KB source.
- Six replication pilots: 3,371 lines / ~92.7 KB source combined.
- At least 134 normalized non-trivial source lines are common to all six pilots; category/diary are the closest pair in the sampled normalized line-set comparison (Jaccard 0.578).
- The installed `appwrite@26.2.0` TablesDB client supports `transactionId` on row operations and transaction create/update methods upstream; `src/lib/sdk.ts` already models `transactionId` on row parameters but does not expose transaction lifecycle calls.
- `appwrite-functions/message-action/friendship.js` and `scripts/lib/friendship-repair.mjs` already implement transaction-scoped read/write/commit/rollback patterns in this repository.
- `BUILD_VS_REUSE_AUDIT.md` contains the full candidate matrix, external references, rejected substitutions, and proposed implementation batches.

## Acceptance path

1. This final checkpoint commit requests `[verify:focused]`.
2. Focused-green task PR is squash-merged into `refactor/build-vs-reuse-audit`.
3. Stable Preview runs the full canonical gate and exact-tree Vercel Preview.
4. Any CI/deployment failure is investigated and repaired before handoff.
