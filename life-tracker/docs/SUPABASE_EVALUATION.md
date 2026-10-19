# Supabase backend feasibility — isolated development experiment

Updated: 2026-10-18. **Not an approved provider migration or production backend.**

## Boundaries and cost

- Only Supabase project `mosaic-dev`, project ref `hcxtiifzxoaflhjgoglb`, Singapore (`ap-southeast-1`), under the user's Free organization. Management API quoted **$0/month** for project creation and returned `ACTIVE_HEALTHY`.
- Existing unrelated Supabase projects, Appwrite Scratch, Appwrite Production, Auth users, Storage, Functions, Vercel and Mosaic's shipped client are untouched.
- Do **not** import real Mosaic data, switch environment variables, issue auth credentials, deploy Functions or promote any Git branch without the applicable approvals. No secrets, signing keys or service-role tokens are stored here.
- This prototype deliberately has no real signed-HTTP-client workflow. SQL `SET LOCAL ROLE authenticated` with fake claims exercises PostgreSQL RLS *only*, not Supabase token verification or browser integration.
- Free-plan suitability is **unproven**: measure occupied database bytes (including indexes), egress, Storage/Realtime use, project idle behavior, backup strategy and multi-project separation before deciding to migrate.

## What is live in the isolated project

The migration records in `mosaic-dev` (read back through the Supabase management connection) are:

1. `create_isolated_mosaic_sync_probe`: `public.mosaic_sync_probe`, a tiny owner table with an actual `auth.users` foreign key and four `auth.uid()`-scoped RLS policies; deliberately left **empty** pending an actual signed-user test.
2. `create_isolated_rls_sync_feasibility_probe`: disposable `public.mosaic_poc_items`; owner-only RLS policies, immutable row identity, server-side timestamps. **No `auth.users` FK** only so fake JWT claims can be used without creating Auth accounts. This table **must not be copied verbatim as a production migration**.
3. `isolate_commit_ordered_poc_change_revisions`: adds `change_seq` and a private per-owner counter. A SECURITY DEFINER trigger with fixed `search_path` serializes same-owner writes via a transactional upsert/row lock. Hard deletes are denied; `is_deleted` tombstones remain visible to incremental pulls.

Source SQL is checked in under `supabase-poc/migrations/` in application root, solely for reproducibility. **Do not replay these CREATE migrations against the already-initialized project.** They are not wired into Mosaic CI auto-deployment.

## Tests actually executed (all synthetic)

- In a single `BEGIN`/`ROLLBACK` transaction, simulated Alice and Bob: owner-only read, owner update, cross-owner update affecting zero rows, forged cross-owner insert denied, hard-delete denied, owner tombstone accepted, attempts to override timestamps/revisions neutralized, ownership reassignment denied, independent owner sequence counters all **PASS**.
- Anonymous role SQL SELECT denied (**PASS**).
- A temporary load of 3,000 rows per owner, ordered `change_seq > 2500` returning 100 rows, used `mosaic_poc_items_owner_seq_idx` as an `Index Scan`. PostgreSQL `EXPLAIN ANALYZE` reported approximately **0.074 ms execution** for this one warm-cache database-only query (6,000 rows in same transaction). This is **not** end-to-end latency, an RxDB benchmark, or sustained performance evidence.
- Original `updated_at,id` index experiment on 8,000 temporary rows returned a 100-row indexed page at approximately **0.101 ms database execution**. Timestamp-only cursors remain unsafe under out-of-order concurrent commits; use a proven commit-ordered marker or another consistent replication contract.
- After rollback, `mosaic_sync_probe` and `mosaic_poc_items` each contained **zero rows**. Supabase Security Advisor returned **no lints**.
- Final read-only size snapshot: entire experiment database **12,785,331 bytes (~12.8 MB)**; the disposable `mosaic_poc_items` relation including indexes occupied **1,736,704 bytes (~1.7 MB)** even though no rows remained. Rollback restores logical rows, not necessarily previously allocated relation pages; these bytes are not a user-scaling forecast.
- Performance Advisor reported only informational unused-index candidates at inspection time; do not remove a required cursor index based on the empty test database.
- The SQL checks are in `supabase-poc/tests/` and were executed through the management SQL connection. They have **not** been run as real client SDK/JWT/API, Realtime or multi-device tests.

## Why this does not replace Mosaic's existing backend yet

Mosaic currently relies on eight owner-scoped RxDB replication domains: tasks, categories, diary, settings, friendships, messages, bucket lists and bucket-task links. In addition it requires shared social visibility, messaging authorization, server-side compare-and-set, media permissions, account erasure, client-version compatibility, and disaster recovery. The tested probe covers only an **owner-private task-like row**, not the real task schema or those domains.

An actual migration needs all of the following before any application switch:

1. A faithful domain/schema/permission mapping, especially friends, blocked-user access, per-recipient messages, shared task references, tombstone retention and sensitive diary visibility. The probe intentionally does **not** establish these policies.
2. Real Supabase Auth user sessions: authenticated `anon`/JWT SDK calls, wrong-user, revoked-session and cross-user request tests. Existing Appwrite user IDs and password-hash portability must be resolved without unsafe password resets or credential exposure.
3. Concurrency: multiple real database connections racing updates; prove revision order across transactions and rollbacks, compare-and-set conflicts, duplicate retries, reordering, tombstone expiry, multi-tab/device and offline returns. A per-owner counter serializes writes and may become a hotspot; quantify costs. Privileged multi-owner writes need deterministic lock order to avoid deadlocks.
4. A new RxDB adapter that persists only acknowledged checkpoints, handles local pending writes, reconnect missed events and service outages, and preserves the exact preexisting Appwrite data/permissions during any staged cutover.
5. Quantified free-tier envelopes: rows, bytes, indexes, RLS cost, read/write rate, 95th percentile sync latency, Auth and realtime connection limits, photo/object storage/egress, plus a backup and disaster-recovery approach independent of this experimental project.
6. A reversible dual-run/cutover strategy with real encrypted backups and explicit release approval. Never run both providers as independent authoritative writers.

## Migration candidate v1 — private tasks/categories (2026-10-18)

- Active migration [#967](https://github.com/carlers/mosaic-life-tracker/issues/967). The isolated Supabase `mosaic-dev` project now holds two additional migrations: `create_mosaic_candidate_tasks_categories_owner_rls` and `deny_candidate_physical_deletion_default_grants`. Their sources are in `supabase-poc/migrations/`. **Do not replay** CREATE migrations on an initialized target, or run any POC migrations in production/CI.
- Candidate `public.mosaic_candidate_tasks` and `public.mosaic_candidate_categories` preserve the current RxDB *string document IDs* (text) but authenticate the owner through Supabase `auth.uid()` (UUID). An explicit mapping from old Appwrite `userId` identities is essential. Password/session portability and relational user references remain unresolved.
- Task columns represent the current task fields for analysis. `order` maps to `order_index` and `date` maps to `task_date`. Owner-only RLS prevents social reads **even when visibility says public/followers**. That fail-closed limitation is deliberate until recipient, friendship, blocked-user and notification authorization are proven. Media may not be copied as inline database content without a capacity/security design.
- Private per-owner revisions serialize writes across tasks and categories. `change_seq` is allocated transactionally by a fixed-search-path SECURITY DEFINER trigger. CAS updates filter on the expected sequence; a stale write then changes zero rows. One SQL transaction does not prove real concurrent-client behavior or a full RxDB adapter.
- **Found and corrected a security fault:** Supabase's default `authenticated` grant included physical `DELETE` on newly created public tables, despite explicit migration grants listing only SELECT/INSERT/UPDATE. An adversarial test **failed**. A follow-up migration revokes all authenticated privileges and explicitly regrants only SELECT/INSERT/UPDATE. Verified: cross-user read/insert/update denied, forged client revision overwritten, owner ID immutable, stale CAS ignored, hard DELETE blocked, tombstone revision advanced, anonymous reads denied.
- Ran the committed rollback-only SQL scripts on `mosaic-dev`. All checks PASS after the fix, and readback found 0 candidate task rows, 0 candidate category rows and 0 owner counter rows. Supabase Security Advisor returned no lint findings. These are SQL role simulations with fake claims, **not real signed JWT/HTTP/SDK/Realtime or multi-device tests**. No data migration was performed.
- This schema is an experiment: there are no category foreign keys or social sharing policies; constraints and media representation need parity tests with current RxDB. The project remains free and isolated; no backend switch or Production change.

### Provider direction and future portability

Supabase Free provides unlimited API requests, **not** unlimited disk, egress, compute or Realtime. Relevant official Free quotas: 500 MB of Postgres database per project, 5 GB monthly organization egress, 2M monthly Realtime messages, 200 peak Realtime connections, and 500K Edge Function invocations. Monitor measured use and require an independent restore strategy. Provider self-hosting should reuse standard PostgreSQL migrations, config-driven endpoints, policies and no browser service-role credentials.

Track the actual Appwrite→Supabase migration in [#967](https://github.com/carlers/mosaic-life-tracker/issues/967). The optional dual cloud/home-server replication idea is separate **post-1.0 planning only**, in [#968](https://github.com/carlers/mosaic-life-tracker/issues/968); never introduce two independent authoritative writers during this migration.

## Source-only mapping candidate (same isolated migration initiative)

- `supabase-poc/candidateMapping.ts` is a **pure, non-runtime** converter for the current task/category RxDB contracts and the candidate SQL columns. It is not imported by Mosaic's production bundle; no SDK, HTTP network call or backend environment variables are switched.
- Conversion requires an explicit verified mapping from legacy Appwrite account ID to Supabase Auth UUID. The helper refuses foreign-owned local input or remote rows; it does *not* prove the mapping is legitimate or authenticate the HTTP client. Existing string document IDs, category references, text date formats, empty optional strings, tombstones, legacy timestamps, source/reactions and per-domain field names remain stable across round trips.
- Server-controlled `change_seq` and `server_updated_at` are deliberately absent from outgoing rows, and a separate revision parser uses arbitrary-precision `bigint` with rejection of unsafe JavaScript numeric cursors. Persisting/advancing a durable RxDB cursor still needs a separately verified adapter, not this helper.
- `tests/unit/supabaseCandidateMapping.test.ts` covers round trips, wrong-user rejection, identity validation, server-field suppression and cursor precision. This is automated pure-mapping coverage, **not** an authenticated Supabase SDK, concurrent transaction, Realtime or real migration acceptance test.

## Atomic CAS hardening and fail-closed pull research (2026-10-19)

- Discovered that the first task/category candidate granted ordinary `authenticated` UPDATE, allowing a client to **omit the WHERE change_seq compare-and-set condition**. The earlier stale-write test only exercised correct callers, not enforced safety. This was a genuine candidate design gap. **Fixed only on isolated Supabase `mosaic-dev`:** revoked direct UPDATE/DELETE, granted owner-table SELECT/INSERT, and installed narrowly allowlisted category/task CAS RPCs (`public.mosaic_candidate_cas_category`, `public.mosaic_candidate_cas_task`).
- RPCs are `SECURITY DEFINER` with fixed empty `search_path`, enforced `auth.uid()` owner filter, required positive expected revision and allowlisted mutable fields. Stale, missing or foreign-owner updates return a null row; caller must read its own master before resolving conflicts. A row trigger increments the per-owner revision inside the update transaction. No general client SQL UPDATE access remains, and anonymous RPC execution is revoked.
- Security Advisor currently reports **two warnings**: authenticated users may execute the intentionally privileged public CAS functions. This is a reviewed *experimental exception*, **not** a clean security audit. Any eventual production use needs independent threat review, real JWT/HTTP tests, request-schema and abuse-rate validation, and a choice between these narrow privileged RPCs and a comparably atomic safer design.
- Initial RPC test failed because `jsonb_object_length` is not a PostgreSQL built-in. Corrected to `p_patch = '{}'::jsonb`, replayed the stored rollback-only adversarial test, and verified valid updates, direct-update denial, wrong owner, stale CAS, invalid payload, anonymous denial and tombstone update. Source migration (`supabase-poc/migrations/20261019_candidate_atomic_cas_rpc.sql`) is the **introspected final state** of the deployed functions; it is only for an otherwise clean disposable candidate **after prior migrations**. Do not replay DDL on the initialized experiment or from CI.
- A separate two-request candidate concurrency probe seeded one synthetic category, then sent two independently issued CAS requests with the **same expected revision**. One updated it to sequence 2 and the other returned null; final state held only the winner. Cleaned up the row and owner counter (both 0). This proves competitive stale-revision rejection for that test; it does not measure physical overlap duration, transaction isolation under every error/failover or RxDB device convergence.
- The source-only `supabase-poc/candidatePull.ts` accepts an injectable authenticated-transport *interface*; it does **not** implement HTTP/SDK, signed-in sessions, or run as part of Mosaic. It checks owner identity before requesting data, rejects foreign rows, missing tombstone markers, duplicate/unordered/out-of-range revisions, invalid pages and unsafe numeric bigint representations. Only after the entire page validates does it return an advanced string checkpoint. A logical `isDeleted` tombstone remains `_deleted:false` for RxDB replay.
- `tests/unit/supabaseCandidatePull.test.ts` covers synthetic cursor paging, >2^53 revisions, offline errors, missing events followed by next pull, wrong-owner failures and checkpoint nonadvancement. **This is a pull-boundary contract test, not an RxDB integration or a working sync app.** The authenticated HTTP adapter, signed two-user account tests, write-path integration, replay, notifications and account migration remain incomplete.

## Disposable authenticated-HTTP transport boundary (2026-10-19)

- `supabase-poc/candidateHttpTransport.ts` is a **source-only** REST adapter for the candidate task/category read API. It takes a configurable HTTPS endpoint (or localhost HTTP for development), an explicitly public publishable key, and a supplied `getVerifiedSession()` provider. No key, access token, user email or real account is committed. It has **no runtime imports from the app** and does not use network APIs in production.
- Requests are owner- and revision-scoped: `owner_id=eq.<uuid>`, `change_seq=gt.<decimal>`, ordered ascending, page size max 100, with `Authorization: Bearer ...` and `apikey` headers. Browser credentials are omitted and caching disabled. A session and account epoch are checked **both before and after** the HTTP request to prevent using a response after an account change; 401/403 are distinguished from service errors. No blanket retry or fallback to another user.
- Tests use an **injected fake Fetch and a fake verified-session provider**, including a valid synthetic page flowing into the previously tested checkpointed mapper, mismatched owner, session switch, wrong HTTP status, malformed response and blocked insecure remote URLs and modern secret-key prefixes. This does **not** establish the caller has a legitimate server-verified token; a real SDK provider must perform that check.
- For future self-hosting portability this transport needs no hardcoded Supabase Cloud hostname; the Auth, RPC, Realtime, Storage and operational equivalence remain separate investigations. The \`getVerifiedSession()\` design must be reviewed for Auth roundtrip overhead and how to tie access token/epoch to the same verified identity.
- **Still not done:** create two disposable signed-in users through an authorized Auth test path, send actual PostgREST calls from separate user sessions, test revoked/expired JWT, connect RxDB's durable pull/push checkpoints, and prove live Realtime wakeups. Neither a mock HTTP test nor a simulated SQL RLS test substitutes for this.


## Candidate server-verified Supabase Auth boundary (2026-10-19)

- `supabase-poc/candidateVerifiedAuth.ts` now supplies the previously missing
  `CandidateSessionProvider` implementation. It takes an injected, ephemeral
  `getSessionSnapshot()` (raw access token plus session epoch) from an eventual
  signed-in Supabase Auth SDK, and calls **GET `/auth/v1/user`** with the token.
  The returned server-side user UUID, **not locally decoded JWT claims**, is the
  identity used by the existing owner-scoped REST pull transport.
- It forbids non-TLS public URLs, URL credentials/path/query, secret keys,
  malformed account IDs and missing/invalid session snapshots; requests use
  no browser credentials, no cache and no redirects. After Auth verification
  it rechecks **both the raw token and epoch**, rejecting sign-out, account
  switches or token rotation during the request. Auth 401/403 fails closed;
  network/server failures do not fall back to cached unverified identity.
- `tests/unit/supabaseCandidateVerifiedAuth.test.ts` covers these invariants
  with injected **mock** Auth and PostgREST requests, including successful
  two-stage REST pull integration and foreign-account denial. No token, user,
  service-role credential or project URL is committed.
- The previously accepted `mosaic-dev` project remains unchanged. This is
  **not evidence of actual Supabase-signed HTTP**: the management connector
  cannot create/sign in disposable Auth accounts; genuine JWT/401/403,
  revoked token, two-account RLS, account migration, RxDB durability,
  realtime, media, CAS RPC authorization and two existing Security Advisor
  warnings must still be resolved before any app/provider switch.
- Both the Supabase and OCI #975 efforts remain independent. Appwrite-only
  UI changes can proceed in `dev` through their normal Preview/CI path,
  since neither experiment is imported by the running app.


## Candidate atomic compare-and-set HTTP push (2026-10-19)

- `supabase-poc/candidateCasTransport.ts` adds an **isolated-only** write
  transport for existing candidate task/category rows using the precisely
  scoped authenticated `mosaic_candidate_cas_task` and
  `mosaic_candidate_cas_category` PostgREST RPCs. These were previously
  verified in synthetic SQL. It does **not** issue a direct unrestricted
  table `UPDATE`, which the candidate database deliberately revokes.
- The transport requires a server-verified owner session, exact legacy
  document ID, positive precision-safe expected revision **as a string**,
  and a strict domain-specific patch allowlist. An RPC `null` response
  is a conflict (stale, missing or foreign), **never** a write success or
  silent retry. Successful replies must have matching owner/row ID,
  a boolean logical tombstone flag and a strictly advancing revision.
- The candidate GET transport additionally rejects token replacement
  mid-request **even when the session epoch was not incremented**.
  The write transport checks both token and epoch before/after RPC.
  Unit tests use fake authenticated HTTP and cover CAS success,
  >2^53 revisions, conflicts, injected fields, foreign responses,
  account switches and 401/403/5xx failures.
- **Still not done:** this transport isn't used by live Mosaic RxDB,
  doesn't implement inserts, durable per-document revisions or conflict
  master retrieval, and has **not executed the RPC through a genuine
  signed Supabase Auth session**. A real two-account HTTP/RLS test,
  security audit of the existing two intentionally exposed
  `SECURITY DEFINER` RPCs, offline idempotency/concurrent devices,
  all social/diary domains, Storage, Functions and encrypted disaster
  recovery remain acceptance blockers.

## Next experiments, in order

1. **Authentication:** create two disposable Supabase Auth accounts in this isolated project when safe automated Auth-user tooling is available, exercise real JWT data requests against `mosaic_sync_probe`, then delete test accounts. No real user data.
2. **Replication correctness:** build an offline-only RxDB adapter lab using disposable rows; stress real concurrent transactions, task conflicts, live Realtime reconnect, idempotency and stable checkpoint resume. Keep existing Appwrite runtime untouched.
3. **Cost/performance:** measure query/egress/storage cost at realistic 1K/10K/100K rows per active user; repeat under RLS and internet latency. Verify Free limits against current official docs.
4. **Decision gate:** compare instrumented Appwrite reads after quota hardening to Supabase Free's capacity and operations cost. Present owner with a quantified accept/reject proposal before implementing a provider migration.

See `supabase-poc/tests/` for repeatable *rollback-only* test SQL. Keep this experiment separate from issue #858 Calendar performance and Mosaic's pre-1.0 production release plan.

## Genuine signed-user denial-path probe (source-only, 2026-10-19)

- supabase-poc/signed-auth-probe.mjs is an opt-in, local-only command hard-locked to isolated mosaic-dev (https://hcxtiifzxoaflhjgoglb.supabase.co). It cannot target any other Supabase project, Production, or self-hosted URL. It accepts only a modern sb_publishable_ key (not legacy JWT anon/service-role keys or sb_secret_ keys), and is not called by Mosaic runtime.
- Prerequisite: provision two distinct, confirmed **disposable** email/password accounts in mosaic-dev Supabase Auth. Never use Appwrite Production accounts or real user data. Locally set MOSAIC_SB_PROBE_URL, MOSAIC_SB_PROBE_PUBLISHABLE_KEY, MOSAIC_SB_PROBE_A_EMAIL, MOSAIC_SB_PROBE_A_PASSWORD, MOSAIC_SB_PROBE_B_EMAIL, MOSAIC_SB_PROBE_B_PASSWORD. Use a local secret manager or interactive hidden password input; never commit or paste credentials into chat, shell history, CI or logs.
- Run `npm run supabase:auth:probe` from life-tracker/ after preparing the two disposable accounts. It performs Auth password grants, verifies each token via GET /auth/v1/user, authenticated SELECT shape, wrong-owner SELECT, direct UPDATE/DELETE denial, anonymous SELECT/RPC denial, missing-id CAS null conflicts, and forbidden CAS patch rejection. Uses a random non-existent document ID. No fixture rows, Auth accounts or tokens are created, persisted or removed by the command. Only non-sensitive check counts are printed.
- tests/unit/supabaseSignedAuthProbe.test.ts uses FAKE HTTP to check project isolation, authorization boundaries and failure handling. Mock tests alone do not prove real signed JWT behavior. An actual PASS with both disposable signed-in accounts is required before signed-HTTP milestone acceptance.
- Caution: if the experimental candidate tables are empty, foreign SELECT returning [] cannot independently establish isolation. This first pass is a low-impact denial/route probe only. Separate real owner-owned fixtures, authorization and two-connection same-revision CAS race tests are still required; independently review the two unresolved Security Advisor warnings on callable SECURITY DEFINER CAS RPCs. Never switch Mosaic backend, Production data or release status based on these checks.


## Source-only atomic pulled-document/checkpoint contract (2026-10-19)

- `supabase-poc/candidatePullCoordinator.ts` layers on the existing validated task/category cursor pulls and owner mapping. A local account snapshot includes both old Appwrite and mapped Supabase UUID plus a session-generation epoch. Every page rechecks the account after the store checkpoint read, after network, **inside** the store's commit guard, and after its commit returns. An unexpected account switch fails closed.
- A `CandidateReplicaStore` contract separates the future RxDB/IndexedDB implementation: `readCheckpoint(scope,domain)` and `applyBatch({scope,domain,expectedCheckpoint,nextCheckpoint,documents,isCurrent})`. The implementation **must** atomically apply all pulled documents and advance the cursor, reject changed checkpoints with `stale`, recheck account fence within the transaction, and refuse remote overwrites of locally pending/unacknowledged edits. It may not silently ack a page if applying a document fails.
- The caller advances only after an `applied` store acknowledgment; `stale` requires a separate repoll, with no blind retry. HTTP/offline failures, malformed pages, foreign owner rows, stale or unsafe bigint revisions, storage failures and account changes cause no acknowledged progress. `isDeleted` stays a **logical tombstone** and `_deleted` stays false.
- Synthetic Vitest tests model the atomic store and prove replay from the old cursor after a failed commit, eventual recovery from offline, concurrent pulls with one stale loser, and account/pending-local-write fences. The test store is **an in-memory stand-in**, not a real persistent transaction, RxDB replication, IndexedDB, offline write queue or actual multi-device test.
- **Critical remaining step:** implement and verify a real persistent RxDB/IndexedDB `CandidateReplicaStore` with atomic document+checkpoint writes and pending-local-write preservation, then actual signed-user HTTP, real concurrent CAS, insert/idempotent push and conflict master-fetch. A replayable synthetic test is not equivalent to device/browser durability.
- No Supabase SQL changes, cloud writes, schema migrations, Auth accounts, shipped runtime imports, real user data or release promotions are introduced by this research branch.

## Source-only create and authoritative master-read HTTP candidate (2026-10-19)

- `supabase-poc/candidateCreateTransport.ts` adds **opt-in, unshipped** `POST /rest/v1/mosaic_candidate_{tasks,categories}` insert using an owner-validated RxDB mapping. No upsert, overwrite or duplicate retry; `Prefer: return=representation` requires server-authored `change_seq` proof, rejecting missing, foreign, malformed and unsafe JS numeric revisions. Client-controlled change-sequence/server time never sent. Row IDs conform to Mosaic's 1–36 character alphanumeric/underscore contract, without a leading underscore.
- An exact HTTP 409 prompts a **separate owner-filtered GET** for the current master, returning explicit `conflict` for RxDB merge handling. If no visible owner master is returned, fail closed; do not pretend a duplicate succeeded. Other errors are never retried automatically: network interruption after POST is ambiguous and must be resolved by reading master before any further push.
- Every create/read checks the server-verified account and raw token/session epoch **before and after** remote requests. Only HTTPS or loopback roots and modern `sb_publishable_` keys are accepted; no service-role/legacy JWT keys, credentials or logged API bodies. Tests use mocked HTTP and cover create, duplicate/master conflict, forged fields/owner, unsafe revision, token changes, wrong account and service failure.
- This does **not** prove actual signed Auth or live PostgREST behavior. There is no production/upstream import, account creation, data migration, RxDB push handler, conflict resolution, client queue or broad domain parity. The two intentionally exposed privileged CAS RPCs still require a separate security review.
- Architectural direction: prefer RxDB's existing `replicateRxCollection` and built-in durable replication checkpoint over introducing a second persistent checkpoint store. The earlier `CandidateReplicaStore` is a research contract/test stand-in, **not** approved as a replacement for RxDB's native replication persistence.


## Genuine signed Auth without credentials: isolated local Supabase CI (2026-10-19)

- `supabase-poc/signed-local-smoke.mjs` exercises **real Supabase Auth-issued signed JWTs** using the actual local Supabase CLI Auth and PostgREST services, not simulated SQL `SET ROLE` claims or fake HTTP responses. It is deliberately hard-locked to `http://127.0.0.1:54321` or `http://localhost:54321`; it refuses managed Supabase origins and cannot read a production service key.
- `.github/workflows/supabase-local-signed-auth.yml` provisions disposable Dockerized Supabase services on GitHub Actions, with email confirmations disabled *only inside the ephemeral local stack*, and applies the **same isolated candidate migrations** checked into the repository. It signs up two synthetic accounts, performs password grants and GET /auth/v1/user, creates owner-scoped task/category fixtures, tests positive-owned and negative-foreign RLS reads, owner-spoofed insert and physical-update/delete denials, duplicate insertion, anonymous denial, two simultaneous same-revision CAS writes with exactly one winner, stale/foreign CAS conflicts, forbidden patch fields and a logical tombstone plus cursor replay. No users, real credentials or datasets are copied from the remote project.
- Workflow runs only for the dedicated `chatgpt/967-local-signed-auth-*` task-branch experiment; it is not added to release CI or the shipped client. Supabase CLI config/migrations live in the temporary runner, and `supabase stop --no-backup` removes test data at the end. Results log counts and PASS/FAIL but never generated emails, passwords or access tokens.
- **Limit:** local signed Auth tests validate a provider-real local reproduction of the candidate SQL, **not** the hosted `mosaic-dev` configuration, hosted JWT verification, cloud RLS policies, cross-region latency or 24-hour multi-device behavior. The hosted project still requires separately approved real disposable signed-user acceptance. The local stack has intentionally development-only security settings and must never be published or used with production data.
- Supabase hosted Auth settings were read non-destructively: `anonymous_users=false`, `mailer_autoconfirm=false`, email provider enabled; public signup cannot create two usable no-intervention signed sessions on that project without validated email or a trusted administrative channel. This discovery does not justify disabling hosted email verification or enabling anonymous sign-ins.


### Executed signed-local acceptance and discovered CAS response detail

- **Actual GitHub Actions run [#39192402019](https://github.com/carlers/mosaic-life-tracker/actions/runs/39192402019) SUCCESS** on `chatgpt/967-local-signed-auth-ci-20261019@162032df166405d44be4746c00a9e2202d40166c`. The disposable CLI stack signed up and verified 2 actual Auth accounts; 4 owned reads and 4 foreign-owner reads passed; blocked owner spoof, two direct writes, and two anonymous requests; inserted 4 owner rows, detected duplicate insert; one CAS winner, one stale conflict, one foreign CAS conflict, forbidden patch, logical tombstone and cursor replay passed. All checks exercised **genuine local Supabase-issued JWTs and live PostgREST endpoints**, not mocks or simulated Postgres claims. Runner executed `supabase stop --no-backup`.
- Before the fix, [#39191871670](https://github.com/carlers/mosaic-life-tracker/actions/runs/39191871670) and [#39192192165](https://github.com/carlers/mosaic-life-tracker/actions/runs/39192192165) failed on the contract that a losing CAS response must be JSON `null`. Signed runtime diagnostic proved **owned composite / null composite** under concurrent writes: one real winner and one PostgreSQL typed-null response. The final returned SQL composite with all columns `NULL` is serialized by PostgREST as an *object with all-null fields*, not JSON `null`. Rollback-only hosted SQL confirmed the database typed-null serialization. `candidateCasTransport.ts` now normalizes only a complete, all-null composite into explicit conflict, preserving owner/session fencing and rejecting partial/mixed responses. Added unit regressions and updated local integration assertion.
- Additional hardening: candidate CAS transport now requires a `sb_publishable_` public key and refuses legacy JWT-shaped or secret keys, as the existing create/read/probe transports already do. No migration, prod SDK change or cloud Auth config modification needed.
- **Evidence boundary:** This is *local* Supabase Auth/REST/SQL integration acceptance. It does **not** prove the remotely hosted `mosaic-dev` user provisioning/permissions, provider-side HTTP configuration, actual cross-device RxDB persistence, privileged RPC audit completion or a production cutover. Two Security Advisor findings remain outstanding.


## Isolated RxDB-native task/category replication bridge (2026-10-19)

- `supabase-poc/candidateRxdbPilot.ts` connects previously exercised owner-scoped Supabase REST pull, explicit POST-create/master-fetch, and server-authoritative CAS to the **existing RxDB `replicateRxCollection` API**, as an unshipped pilot. The pilot uses RxDB's native persistent replication identifier/checkpoint plumbing and `pull.handler`/`push.handler` rather than storing a second independent cursor. Its identifier is explicitly different from Appwrite's (`mosaic-supabase-poc-v1:domain:legacy:uuid`). It uses `waitForLeadership`, bounded page sizes, failed-push retry and manual `reSync` for foreground/reconnect; no Supabase realtime subscription yet.
- The candidate's push contract is deliberately **conservative for local-data safety**: only documents belonging to the verified mapped owner can be written; physical deletion is rejected; existing remote master is read before each update. A submitted edit with an `assumedMasterState` is accepted only when the current server document still matches that assumed master, and the CAS uses the revision read from the authoritative server (never a client-authored revision). A created/new document whose server state already exactly equals the intended state is an idempotent retry; a diverging same-ID document, missing master after an assumed edit, simultaneous conflicting CAS, or server-returned mutation throws `CandidatePendingConflictError` instead of returning a master-wins conflict document. This keeps the RxDB local push pending until a *future explicit resolution workflow* decides what to do. Do not silently drop those local edits.
- The pilot is **not launched from `src/`**; no existing Appwrite sync coordinator, production RxDB database, task images, social sharing or other domains use it. Its `start` requires a collection supplied by the isolated test caller. No approval exists to attach this writer to an already-Appwrite-replicating cache: that would create dual backend writers.
- Unit tests cover new-row push, ambiguous response-loss replay, bootstrap divergent master, conflicting insertion, assumed-master mismatch, exact server CAS, CAS race winner re-read, account switch, foreign owner guard, tombstones, bigint cursor, and native RxDB replication configuration. **Mock-based wiring and unit tests do not yet establish persistent Dexie/IndexedDB checkpoints after tab restart or multi-device offline replay**. The next acceptance target is an isolated browser RxDB/Dexie storage restart test and realistic async offline-write restoration against the disposable local Supabase Auth lab, then hosted signed-JWT acceptance and explicit conflict UI/merge policy.
- The existing source-only `CandidateReplicaStore` was an architectural contract only. Reuse RxDB's native checkpoint and owner-scoped replication identity instead of introducing a redundant checkpoint store.
