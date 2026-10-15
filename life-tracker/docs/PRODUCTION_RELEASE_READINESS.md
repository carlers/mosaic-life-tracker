# Pre-1.0 Production release readiness — read-only checkpoint

Checkpoint 2026-10-15, issue [#889](https://github.com/carlers/mosaic-life-tracker/issues/889). **This document authorizes NO backend, protected branch, provider setting or release writes.** Re-read heads, schema, deployment and backup state before every step.

## Current release boundary

- Protected dev `9c3152cdc6f92950cb0b54677b68b86c022508a3` = **v0.29.1** (Diary, Chat, Notifications, accepted #851/#852/#853). Git history is reconciled by PR #906, with exact source tree inherited from premerge dev. Source canonical #38758786372 SUCCESS and trusted CI-first Preview #38759081119 READY. Production main `bb58300052dc4c85974d97779e2b257ec4f28c7d` remains **v0.17.4**. Main is now an ancestor of dev, but the live Production product/backend have **not** been promoted. 1.0.0 remains a separate later decision.
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
- Production `dr-backup` scheduled daily 11:00 UTC; latest read-only returned successful execution 2026-10-15 11:01:22 UTC HTTP 200 (~70.63s), backupId `20261015T110126518Z`. This does **not** prove encrypted R2 `COMPLETED` marker/hash, escrow or isolated restore. Demand independently authenticated `dr:check`, key/marker verification, and isolated restore/rollback proof, without putting real Production user data in shared Scratch.
- Production Web-platform `*.vercel.app` wildcard is a **security review risk**, not an asserted exploit. Preserve existing Production behavior until a separately reviewed origin-policy change. Verify per-user rows, message/Diary friend permissions, push consent and old clients.
- Integrated release candidate must preserve exact main CI/security and current dev product, full canonical test, compatible backend and human authenticated two-account/mobile/offline/PWA checks. Owner separately approves target-specific Production migrations, Function activation, dev/main promotion, ordinary pre-1.0 release and eventual 1.0.0 milestone.

**Order:** verify old-PWA client compatibility/strategy → integrated main/dev candidate → independent recoverable DR backup/restore → individually approved migrations 010–015 and Function rollout → real two-account/offline/device acceptance → separately approved Production release. No step here is evidence that the next step has already passed.

## Exact pre-release reconciliation and verification (2026-10-15)

- User-authorized protected dev ancestry integration [PR #906](https://github.com/carlers/mosaic-life-tracker/pull/906) merged to `9c3152cdc6f92950cb0b54677b68b86c022508a3`, with **zero source-file differences** against accepted v0.29.1 dev. Candidate `2820f7f8f5f2e73250fa929376ba3b55b505ad62` retains both main and dev parents, full [Quality Gate #38758786372](https://github.com/carlers/mosaic-life-tracker/actions/runs/38758786372) SUCCESS on attempt 1, [Trusted Preview #38759081119](https://github.com/carlers/mosaic-life-tracker/actions/runs/38759081119) SUCCESS, and Vercel CLI `dpl_G9THiGgHRsDYc8ktjs4oz5Xj3VQm` READY. Source/config comparison confirmed main-owned privileged trusted PREBUILT scripts, receiver workflow and associated security tests are byte-identical on dev; dev keeps newer quality gate, evidence schema and release budget review #784.
- PR #906 contains no changed files: GitHub's path-filtered Quality Gate does **not** automatically run on that no-diff dev merge. This documentation contract update is a real, reviewed repository change requiring a new task/stable CI-first Preview and postmerge dev Quality Gate; do not misreport a skipped run as success.
- Real immutable [old-client differential #38756019542](https://github.com/carlers/mosaic-life-tracker/actions/runs/38756019542): v0.17.4 `a7d4c431eef6902f1d2d35271b6b8e41f8e9228e` **BLOCKED** for future unknown Diary/message fields; isolated v0.17.5 mapper bridge `81bde2da1d35e95f1b37d39949f8fc5100238908` **PASS** for the same six actually subscribed synthetic schema/write shapes. Bucket List tables were explicitly **UNASSESSED**, not passed. The v0.17.5 bridge is neither shipped nor evidence that an old installed PWA updated or retired. Do not migrate synced Production columns while such old clients may still operate.
- Latest Production `dr_backup` completed schedule HTTP 200, with only sanitized backup-count metadata. It is **not** R2 authenticated `COMPLETED` marker, ciphertext/manifest/hash, independent escrow key or isolated restore proof. Do not restore Production user content into shared Scratch; use a clean isolated target with confirmed approved access.
- #592 failure mode: failed-only retry of Quality Gate #38757706901 passed canonical on attempt 2 but retained build artifact `...-1` from attempt 1; default-main protected receiver failed closed [#38758435207](https://github.com/carlers/mosaic-life-tracker/actions/runs/38758435207). Recovery used fresh full first-attempt candidate. Do not weaken artifact-to-attempt checks to force release.

### Required before the only permitted dev-to-main release

1. Finalize and prove a historical installed-PWA upgrade/retirement or version-aware compatibility mechanism, including reconnect after offline and old-reader safety. The synthetic source checker alone is insufficient.
2. Independently verify newest committed encrypted R2 marker/manifest and decryption/key escrow; successfully restore and verify against an isolated **fresh** Appwrite project (never the shared Scratch instance).
3. Review current Production schema and authorize **each** target-confirmed migration 010–015 individually; preserve Function schedules/previous READY deployment and exact reviewed action/permission union; independently authorize the Production Function activation only after compatible columns and recoverability are proven.
4. Verify a signed-in two-account flow for Diary, chats, reactions, Notifications/Web Push, sync/offline convergence, privacy and installed-device update; distinguish CI/browser fixtures from actual mobile acceptance.
5. After those gates, merge only protected `dev→main` with a successful current exact canonical source, matching Production migration/Function state, main postmerge full CI, target-correct live Vercel READY and release publisher. Do not declare or tag 1.0.0 without separate milestone approval.

Current document and this candidate alone authorize no Production data writes, provider setting changes or irreversible activation.
