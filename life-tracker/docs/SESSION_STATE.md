# Session checkpoint

Updated: 2026-10-05
Current task: Re-audit Chat edge-back behavior on stable Preview `feature/ui-smoothness-navigation`, especially large-screen Comfortable/Wide modes.
Status: Two gesture defects are repaired on `chatgpt/ui-smoothness-wide-edge-audit`. First, edge activation was measured from viewport x=0 instead of the centered route surface, making Comfortable/Wide impossible. Second, allowing a true edge start over a message bubble without exclusive pointer ownership could start both route-back and bubble-reply recognizers, producing dual motion. Edge-back now measures from the live surface, preserves Back/input/native gesture exclusions, takes exclusive ownership only after an accepted edge start, and leaves bubble swipe-to-reply unchanged outside the 32px edge. Browser coverage exercises Full screen, Comfortable, and Wide and checks that the bubble itself stays stationary during route drag.
Next action: Require browser-focused verification to pass, inspect any remaining failures, then squash the task branch into `feature/ui-smoothness-navigation` and require the stable branch's full canonical gate + exact-SHA Vercel Preview. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None known. The detail-to-parent bottom-nav appearance remains a visual/manual smoothness check rather than an automated geometry invariant.

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
