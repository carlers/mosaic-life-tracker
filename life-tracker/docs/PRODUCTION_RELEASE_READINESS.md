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

For this **pre-public owner-only release**, the owner reports no external installed clients and controls the known v0.17.4 installation. An extra v0.17.5 hotfix is **not automatically required**: before Production schema migration, explicitly verify that the owner's installed PWA is synced and updated/reinstalled or safely retired, with no unsynced offline work and no other old installations. This gate is **not passed solely because the owner controls the device**. If any v0.17.4 client remains supported or unaccounted for, retain the legacy block and require the historical bridge or a demonstrably safe alternative. Never create the schema first and hope waiting service workers update.

For later multi-user releases, [client/backend compatibility](CLIENT_BACKEND_COMPATIBILITY.md) and [#914](https://github.com/carlers/mosaic-life-tracker/issues/914) define a pinned supported-client matrix and source-only regression gate. The current pre-public baseline does **not** certify the older Production client or replace offline/mobile acceptance.

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

## Latest release-readiness delta — 2026-10-16 (#889/#914)

This dated section supersedes stale *status* statements above; historical preflight requirements and explicit write gates still apply. Protected `dev@dff508fb30c7db069fc753cd09359627242a3ffb` v0.29.1 has #914 source-only supported historical-client compatibility check in canonical CI; Quality Gate #38856659851 SUCCESS and matching Vercel dev Preview READY. Protected `main@bb58300052dc4c85974d97779e2b257ec4f28c7d` is still v0.17.4; release PR #909 is OPEN and has **not** been approved to merge.

The encrypted Production snapshot `20261015T110126518Z` **has** been independently authenticated and restored with strict data/file/schema/permission equality in a separate Appwrite DR project: 6 users, 2924 rows, 137 files. Owner-reported browser acceptance for restored same-era v0.17.4, then isolated ordered schema migration 010–015, new READY `message-action` and upgraded v0.29.1 Diary/Bucket List/8-group sync passed. This proves a point-in-time restoration and *isolated* upgrade rehearsal, not current Production acceptance. The intentionally migrated DR environment no longer matches the original snapshot; do not rerun snapshot equality against it. The Appwrite null-with-integer-default restoration source fix was accepted on isolated stable `6147e0b4db38a083439ff8f6520785fe782d735a`, full CI #38784784588 SUCCESS; its integration to current dev remains separately gated until approved.

Pre-public installed-client strategy: the owner controls the only **known** v0.17.4 Production PWA; no public users have been onboarded. Therefore a speculative v0.17.5 bridge is not automatically required. **Owner still must positively verify** that every old Production browser/PWA has synced and retained no queued offline changes and is safely closed/upgraded/retired *before* migrations 012/013/015. The compatibility CI does not certify the old 0.17.4 reader or retire service workers. If any old installation remains active/unknown, stop and arrange a proven compatibility path.

Remaining separate approval gates: (1) installed-client retirement proof, (2) six exact target-scoped Production migration approvals/checks in order, with unscoped runner and migration 008 prohibited, (3) production Function package/activation approval with retained previous READY/cron/secrets, (4) authenticated real Production two-account/offline/PWA/device and privacy/notifications acceptance, and (5) explicit #909 promotion and main CI/live deployment/release publication. None of these were authorized by this documentation update. Phase B #914 should be done before broader public adoption, while Phase C is conditional on demonstrated need.

## Latest verified rollout — 2026-10-16 UTC (#889; supersedes status above)

The earlier migration/Function gaps and PWA/DR verification blockers are **historical**, not current state. Owner confirmed all known old Production v0.17.4 PWAs fully synced/retired and independent escrow; authenticated R2 `dr:check` passed for `20261016T110126909Z` (11:02:17 UTC). Six approved 010–015 changes were applied individually from Git definitions through the authenticated Appwrite connector (remote CLI key transfer blocked), verified as Production 17 tables, Diary 9 AVAILABLE columns and Messages 25 AVAILABLE columns, with private reactions and correct indexes. No 008 or broad runner. Active `message-action` source `dev@c733bfa73f4ca742f6333ee75e11c642f83daf53` deployment `6ad20d5de9380307809d` was built READY then activated; previous READY `6acb8162dc02a1deaa23` retained. Hourly schedule, grants and DR privacy variable preserved; daily DR Function unchanged. A subsequent live authenticated Function `get_notifications` returned HTTP 200. Full operational evidence: [issue checkpoint](https://github.com/carlers/mosaic-life-tracker/issues/889#issuecomment-6214794662).

A local Production-configured v0.29.1 build from the exact dev SHA also passed the build/PWA/size gate, served HTTPS root and deep-link successfully and embedded the intended project ID. **That is not acceptance of signed-in multi-account/privacy/offline/PWA/mobile behavior.** Official `dev` and all stable Vercel Previews must keep using Scratch; use the existing registered laptop Production Web platform and follow [the local Production acceptance runbook](PRODUCTION_ACCEPTANCE.md). Real signed-in owner acceptance and explicit #909 dev→main release authorization remain required. Protected `main` remains v0.17.4 and no v1.0.0 decision has been made.
