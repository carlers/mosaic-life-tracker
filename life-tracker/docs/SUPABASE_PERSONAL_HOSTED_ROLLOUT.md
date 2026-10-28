# Hosted six-domain Supabase launch sequence — issue #1027

Status: **read-only inventory and release plan; NOT rollout approval**.
Target: isolated `mosaic-dev` project `hcxtiifzxoaflhjgoglb`, never implicit Production.
Reviewed candidate: `feature/1027-supabase-recovery-20261020@c3a7209ee6fa9a19b8aabc3cc9f49da7f5a85246` (PR #1411). Re-check exact branch and CI before executing.

## Why a direct migration is unsafe

The hosted source has **real rows and authorized sessions**. The new
`20261027183840_enforce_personal_writer_consent.sql` policy applies to raw
REST INSERT, signed CAS UPDATE and private-photo Storage INSERT/DELETE—not
just app feature flags. `personal_release_evidence` intentionally defaults
NULL; applying this final fence before the rollout/consent plan blocks existing
app writes. A browser release flag or merely passing disposable CI cannot
substitute for audited, server-owned release evidence.

Read-only hosted inventory on 2026-10-28 (ephemeral; MUST refresh at execution):
- Auth accounts 87; authorities 87: 3 active `supabase-cloud` and 84 frozen.
- Live tasks 15, categories 2, Diary 2, portable settings 0, Buckets 0, links 0.
- Current live leased sessions 1 and private personal-photo objects 1.
- Registry, personal readiness, personal writer authority and atomic category
  deletion not installed; Settings/Bucket/link Realtime publications 0/3.
- Existing hosted migration history ends at Settings/Bucket links:
  `20261026133252`, `20261026133344`. No new registry/readiness/fence migrations.
- Project ACTIVE_HEALTHY. Auth Management SMTP inspection gives HTTP 401;
  Brevo account existence does NOT prove Supabase reset/confirmation delivery.
- Security Advisor lists seven intentionally authenticated privileged CAS/session
  RPCs plus disabled leaked-password protection; neither issue is waived.

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

2. **Preserve the BEFORE state.** On the trusted operator/approved protected
   runner, obtain a NEW encrypted PostgreSQL + private-media snapshot with
   an exact immutable source digest, complete Auth/private data and no leaked
   plaintext. Independently authenticate and restore the exact snapshot into
   a separate disposable PG17/Auth/Storage target. Existing historic seven-
   table Fedora/R2 evidence is valuable but cannot attest the current hosted
   ten-table contents or future account registry. Do not reuse an old snapshot
   digest as a new proof. Block rollout on any missing data/media, owner
   provenance, RLS mismatch, or nonzero unintended changes.

3. **Prepare additive schema without activating personal writers.** Review
   `../supabase-poc/migrations/20261022_candidate_category_retirement.sql`
   and `20261023_candidate_atomic_category_delete.sql` and all dependent
   schema/consumer changes, then the exact ordered files:
   `20261027170802_mosaic_account_registry.sql`,
   `20261027172600_personal_runtime_readiness.sql`,
   `20261027182613_require_complete_personal_release_evidence.sql`.
   Apply only after encrypted rollback prerequisites and the project-specific
   DDL approval. Inspect grants, policies, functions/search_path, database
   triggers, foreign keys and changed RPCs; verify new default release evidence
   is NULL and cannot be client-written. Verify existing core interactions still
   work before proceeding. An unexpected migration state aborts; never reset a
   populated Supabase project to satisfy a migration.

4. **Prove the NEW state before release.** Take and independently restore a
   registry-bearing **fourteen-table** encrypted snapshot (Auth + personal
   domain rows + four identity registry tables) and all referenced photo bytes
   with exact source/target counts, digests and owner ACLs. Run signed two-owner
   tests on the actual hosted additive schema against disposable marked users:
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

- Database DDL/hosted writer freeze: needs immutable before/after backup,
  an audited rollout and impact acknowledgment. **Not performed.**
- Release evidence marker: server-controlled, not ordinary app consent.
  **Not issued.**
- Real Supabase SMTP/email/reset and leaked password setting: Auth Management
  HTTP 401; needs authorized dashboard or independently signed email test.
  **Unverified.**
- Protected Preview deployment: **waiting for named reviewer**.
- Original Appwrite Cloud remains offline; a safe fresh/recovery-pending
  Supabase launch does not depend on its return. Historical linking/import
  requires separately verified ownership (#1406, #1407).

This plan does not itself promote any backend, migrate real user accounts,
or change `mosaic-dev` hosted schema. Keep the final release gate closed.
