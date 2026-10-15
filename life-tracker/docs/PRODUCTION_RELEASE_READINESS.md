# Pre-1.0 Production release readiness — read-only checkpoint

Checkpoint 2026-10-15, issue [#889](https://github.com/carlers/mosaic-life-tracker/issues/889). **This document authorizes NO backend, protected branch, provider setting or release writes.** Re-read heads, schema, deployment and backup state before every step.

## Current release boundary

- Protected dev `3f225ae64a021c947a77d4528d25afb3f305f17f` = **v0.29.1** (Diary, Chat, Notifications, accepted #851/#852/#853), full canonical and Vercel READY. Production main `bb58300052dc4c85974d97779e2b257ec4f28c7d` remains **v0.17.4**. Branch histories diverge: retain main-only security/trusted deployment workflow AND dev product/CI, do not blindly merge. 1.0.0 is a separate later decision.
- User is testing dev. Human authenticated two-account/mobile/offline acceptance remains independent of automated CI.

## Actual Appwrite Production drift (read-only 2026-10-15)

| Migration | Prod gap versus active Scratch | Compatibility dependency |
| --- | --- | --- |
| `010-bucket-list` | New `bucket_list_items` table absent | Server ownership and older clients |
| `011-bucket-task-links` | New `bucket_task_links` table absent | After 010; owner links |
| `012-diary-emoji` | Optional `diary.emoji` missing (7 vs 9 Diary columns) | Old PWA Diary reads |
| `013-diary-photos` | Optional `diary.photos` missing | Old PWA Diary reads and photo privacy |
| `014-diary-reactions` | Server-only `diary_reactions` absent | New Function authorization |
| `015-message-diary-references` | Four `messages.diary_ref_*` columns missing (21 vs 25) | Old PWA message reads and quote security |

Migrations are independently idempotent but **still write Production**. The unqualified `appwrite:migrate` runner also selects older migrations; NEVER use it broadly as a release action. Approve and run each exact `--only <ID> --project <PROD_ID> --confirm-project <PROD_ID>` in an explicitly reviewed sequence. 008 friendship permission tightening is a separate security operation, never implied. Re-check each column's status and targeted table shape afterward. Capture Function old READY deployment and forward-fix semantics rather than destructive schema rollback.

## Old Production PWA is the first hard gate

The released v0.17.4 `fromAppwriteFormat` passes unknown remote fields through to strict RxDB validation; adding **optional** remote Diary or message fields can therefore break an installed v0.17.4 client. Dev v0.29.1 filters unknown fields.

The read-only historical-source checker tests candidate row schemas AND outgoing owner-scoped payloads. Default checks all 8 currently synced domains, including newer Bucket List collections not necessarily present in an old release. For a reviewed older PWA, explicitly scope to its **actual existing subscriptions**, and document omitted tables as **UNASSESSED**, not passed:

```bash
npm run appwrite:preview:compat -- \
  --consumer-sha <VERIFIED_FULL_V0_17_4_SOURCE_SHA> \
  --table tasks --table categories --table diary \
  --table settings --table friendships --table messages
```

The exact subscribed collections must be verified against that client's original mapper/schema and sync code; do NOT blindly assume this illustrative selection applies to all installed PWAs. Never omit changed `diary` or `messages` merely to obtain PASS. The old mapper is expected to **BLOCK** on unknown fields; actually run the immutable historical source test before any migration. This checker does not prove Appwrite Function authorization, partial update semantics, PWA upgrade timing, offline convergence or login.

Choose and verify a safe legacy-client strategy first: **a separately owner-approved v0.17.x backward-compatible Production client hotfix and proven upgrade/retirement**, or another demonstrated version-aware compatibility mechanism. Do not create new schema first and hope installed PWAs update.

## Backup, Function, security and release gates

- Production `message-action` is older; hourly schedule vs intentionally disabled Scratch cron. Review exact source union, old-client Function actions and permissions; construct inactive exact-SHA production candidate only after explicit approval, retain old READY and separately approve activation after schema/compatibility validation.
- Production `dr-backup` scheduled daily 11:00 UTC; latest read-only returned successful execution 2026-10-14 11:01 UTC HTTP 200 (~68s). This does **not** prove encrypted R2 `COMPLETED` marker/hash, escrow or isolated restore. Demand independently authenticated `dr:check`, key/marker verification, and isolated restore/rollback proof, without putting real Production user data in shared Scratch.
- Production Web-platform `*.vercel.app` wildcard is a **security review risk**, not an asserted exploit. Preserve existing Production behavior until a separately reviewed origin-policy change. Verify per-user rows, message/Diary friend permissions, push consent and old clients.
- Integrated release candidate must preserve exact main CI/security and current dev product, full canonical test, compatible backend and human authenticated two-account/mobile/offline/PWA checks. Owner separately approves target-specific Production migrations, Function activation, dev/main promotion, ordinary pre-1.0 release and eventual 1.0.0 milestone.

**Order:** verify old-PWA client compatibility/strategy → integrated main/dev candidate → independent recoverable DR backup/restore → individually approved migrations 010–015 and Function rollout → real two-account/offline/device acceptance → separately approved Production release. No step here is evidence that the next step has already passed.
