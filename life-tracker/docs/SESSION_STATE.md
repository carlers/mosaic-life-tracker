# Session checkpoint

Updated: 2026-10-05
Current task: UI smoothness/navigation first batch on stable Preview `feature/ui-smoothness-navigation`.
Status: Implementation is complete on `chatgpt/ui-smoothness-chat-swipe` pending browser-focused verification. Chat detail now uses the shared route-drag surface in full-height left-edge Back mode, conversation entry records Messages as the parent, header/swipe Back share history-aware fallback behavior, and message bubbles remain explicit swipe-to-reply owners. Adjacent Messages code/data warms only when Messages is actually reachable, preserving Home startup behavior. Lazy route imports share memoized loaders and generic route suspension uses a stable shell instead of a centered spinner.
Next action: Run the browser-focused gate for the complete task tree, fix any failures, then squash-merge into `feature/ui-smoothness-navigation` and require its full canonical gate + Vercel Preview. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None known before CI. Real Samsung/PWA edge-swipe acceptance remains a manual check after hosted Preview.

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
