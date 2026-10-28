# Hosted six-domain Supabase launch sequence — issue #1027

Status: **21 migrations installed; independently restored fourteen-table AFTER R2 snapshot ACCEPTED. NOT rollout approval.** Final personal writer fence uninstalled; account consent and release evidence unset.
Target: isolated `mosaic-dev` project `hcxtiifzxoaflhjgoglb`, never implicit Production.
Latest audited isolated recovery: `feature/1027-supabase-recovery-20261020@f031bf7f2edbee920537cc535ada3427db2b26aa` (PR #1428; canonical Quality #40671071596 and synthetic fourteen-table restore #40671071694 passed). Re-check branch, CI and hosted catalog before executing.

## Why a direct migration is unsafe

The hosted source has **real rows and authorized sessions**. The new
`20261027183840_enforce_personal_writer_consent.sql` policy applies to raw
REST INSERT, signed CAS UPDATE and private-photo Storage INSERT/DELETE—not
just app feature flags. `personal_release_evidence` intentionally defaults
NULL; applying this final fence before the rollout/consent plan blocks existing
app writes. A browser release flag or merely passing disposable CI cannot
substitute for audited, server-owned release evidence.

## Verified post-registry hosted state (2026-10-28; read-only)

- Project `mosaic-dev` (`hcxtiifzxoaflhjgoglb`) is ACTIVE_HEALTHY, PostgreSQL 17.11.
- **21 migration records**, including category retirement, atomic category deletion, identity registry, personal readiness, and complete release-evidence constraint. **Do not replay these five migrations**.
- 87 Auth users, 87 fresh core authorities, 87 canonical Mosaic accounts, 87 verified provider bindings, 87 identity audit rows, one installation; **zero missing/orphan bindings**.
- All four private registry tables have RLS enabled and no direct `anon` or `authenticated` SELECT/UPDATE/DELETE grants. Private identity triggers deny direct execution by both roles. Signed-only `mosaic_account_status` and `mosaic_personal_readiness` have empty function search paths and deny anonymous execution.
- All three Settings/Bucket/Bucket-link Realtime publications are present.
- **Zero** accounts with recorded consent and **zero** installations with release evidence. The separate `20261027183840_enforce_personal_writer_consent.sql` is **NOT installed** (writer function, consent constraint and Storage restrictive policy absent).
- A previously encrypted **ten-table BEFORE** R2 generation `20261028T053525682Z` passed complete independent PostgreSQL/Auth/private-media restoration. **Never repeat or prune it.** The registry-bearing **fourteen-table AFTER** snapshot and independent fresh restore have now passed.
- R2 credential pair verification later passed independently for reader and writer. The owner then **successfully published** the fourteen-table Auth/PostgreSQL + complete private-media R2 generation `20261028T100954899Z`; independent R2 ciphertext watch and full age authentication PASS. **Never repeat that already-completed backup.** The earlier PG17 restore failure was repaired in PR #1428; the owner later verified exact fourteen-table PG17 row parity, original-password signed GoTrue owner/foreign isolation, private-media restore including nonempty synthetic photo, and full cleanup. Final `MOSAIC_R2_EXACT_SNAPSHOT_DISPOSABLE_RESTORE_PASS: 20261028T100954899Z` passed. No new backup/restore action is needed.
- Security Advisor currently flags nine authenticated-callable privileged RPCs and disabled leaked-password protection; see [privileged review](SUPABASE_PRIVILEGED_CAS_REVIEW.md). Hosted SMTP/reset/redirect allowlist/device acceptance remain unverified.

The earlier pre-DDL inventory (16 migrations and no registry) is historical only, **not** the current state. Re-verify the latest hosted records before each operation.

Do not export password hashes, owner identifiers, private data, or database
credentials to CI logs, GitHub issues, ChatGPT or a browser.

## Ordered gates — all mandatory

1. **Pin source, scope and owner approval.** Confirm branch SHA, exact additive
   SQL list, migration table and the project ref. Securely compare live 10-table
   source inventory, including Auth, owner revisions, original Tombstones, and
   full private Storage. Existing owner reads/exports must stay possible.
   Resolve active writer/lease impact and any old installed PWA compatibility.
   Approval to work on isolated Preview is NOT approval to freeze existing
   app users, import original Appwrite history or promote Production.

2. **Preserve the BEFORE state — completed.** The immutable ten-table
   `20261028T053525682Z` PostgreSQL/Auth + entire private-media generation
   was independently restored with signed owner and foreign-owner rejection.
   Do not recapture or overwrite this accepted BEFORE proof. If the live source
   changes before release, require a separate newly approved gap evaluation;
   a historic restore is not an AFTER-state attest.

3. **Verify installed additive schema — completed, do not replay.**
   Exact migrations already installed on `mosaic-dev`:
   `20261022_candidate_category_retirement.sql`,
   `20261023_candidate_atomic_category_delete.sql`,
   `20261027170802_mosaic_account_registry.sql`,
   `20261027172600_personal_runtime_readiness.sql`, and
   `20261027182613_require_complete_personal_release_evidence.sql`.
   Recheck all 21 migration records, four private mapping tables,
   owner/mapping invariants, grants, RLS, and Realtime before any later stage.
   Do **not** run the final personal-writer enforcement migration as part of
   this step. All consents and release evidence are still unset.

4. **Prove the NEW state before release.** The **14-table AFTER-state disaster
   recovery gate is closed** by independently restored encrypted PostgreSQL/Auth
   and full private-media R2 generation `20261028T100954899Z`. Preserve this
   marker and ten-table BEFORE `20261028T053525682Z`; never recapture them.
   **Still required:** signed two-owner tests on the actual hosted additive
   schema against disposable marked users:
   signup/consent, owner-scoped access, foreign exact-ID deny, CAS/stale/conflict,
   account-switch/epoch/lease, category-delete, ZIP/photo and no email-only
   account claiming. Preserve cleanup and independent zero-live-fixture audit.
   Run and review security advisors and SMTP signup, confirmation and password
   reset email delivery. A synthetic lab marker alone does not attest a hosted
   release. Treat hosted Auth-config HTTP 401 as unresolved, not success.

5. **Only after audited gates and separate consent/cutover authorization**:
   install/enable the final six-domain/Storage writer enforcement
   `20261027183840_enforce_personal_writer_consent.sql`, with its required
   server-owned `personal_release_evidence` generated from the exact reviewed
   schema SHA, successful signed run and successful fourteen-table restore.
   Specify and review the trusted administrative marker-writing mechanism;
   never let browser clients or a public RPC issue it. Re-read actual rows and
   RLS, verify that unconsented/stale/non-authoritative writers receive 403,
   while consented signed fresh/recovery-pending accounts can write after
   lease acquisition. Old-client write refusal is intentional but its effect
   on existing sessions must be explicitly addressed.

6. **Deploy and accept the protected Preview**, at the exact accepted SHA,
   only through the named environment reviewer. Test signup, reset delivery,
   tasks/categories/Diary/Settings/Bucket/links, photo bytes, ZIP, offline
   reconnect, second device, old PWA and account switching. Never assume a
   successful CI artifact is an actual approved Vercel deployment.

7. **Release gate/rollback.** Supply exact SHA, current CI, hosted signed tests,
   backup/restore proof and immutable rollback marker, account-history limits,
   TTLs, SMTP proof, quotas and manual device evidence. Stop for owner approval
   before `dev`, `main`, production authority or app release. On failure
   refuse new writes, retain private historical snapshots, avoid dual writers,
   and restore only under an explicitly validated authority/epoch protocol.

## Current blocker ownership

- **AFTER-state offsite DR — CLOSED:** immutable `20261028T100954899Z` passed read-only download, full age authentication, exact fourteen-table PG17 source/target row recovery, original-password signed owner and foreign-owner tests, private media with nonempty synthetic photo and disposable cleanup. Preserve both it and the independently restored BEFORE `20261028T053525682Z`. No further backup/restore step is required. Hosted SMTP/OAuth/JWT and user-device tests are separate.
- **Final writer fence and release evidence:** migration `20261027183840_enforce_personal_writer_consent.sql` is not applied, installation release marker is NULL and account consents are unset. Do not activate or set evidence before restored AFTER-state and separately authorized signed tests, consent/cutover and old-writer impact review.
- **Changed hosted acceptance:** reviewed `--post-registry` signed two-owner mode is implemented and tested. The protected `Supabase Hosted Signed Acceptance` GitHub Actions workflow is now the preferred one-run handoff, with a dedicated restricted/approved `mosaic-supabase-hosted-acceptance` environment and expiring project-scoped secret. It still must run against real `mosaic-dev` before this gate can close. It covers registry/consent/readiness, category retirement/atomic deletion, six-domain RLS/CAS and independent synthetic-fixture retirement. CI cannot substitute for this hosted live execution.
- **SMTP/password recovery:** disposable local GoTrue email recovery has passed, but hosted sender, redirect allowlist and actual inbox reception remain unverified. Auth Management inspection returned HTTP 401. Leaked-password protection remains disabled.
- **Protected Preview:** named reviewer/device/browser verification and old-PWA writer controls remain outstanding; `dev`, `main` and Production are not approved.
- **Historical Appwrite accounts:** no email-only identity claim or silent import. Original Appwrite Cloud remains unavailable; independently verified linkage is deferred under #1406/#1407.

This plan does not itself promote any backend, migrate real user accounts,
or change `mosaic-dev` hosted schema. Keep the final release gate closed.
