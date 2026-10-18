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

## Next experiments, in order

1. **Authentication:** create two disposable Supabase Auth accounts in this isolated project when safe automated Auth-user tooling is available, exercise real JWT data requests against `mosaic_sync_probe`, then delete test accounts. No real user data.
2. **Replication correctness:** build an offline-only RxDB adapter lab using disposable rows; stress real concurrent transactions, task conflicts, live Realtime reconnect, idempotency and stable checkpoint resume. Keep existing Appwrite runtime untouched.
3. **Cost/performance:** measure query/egress/storage cost at realistic 1K/10K/100K rows per active user; repeat under RLS and internet latency. Verify Free limits against current official docs.
4. **Decision gate:** compare instrumented Appwrite reads after quota hardening to Supabase Free's capacity and operations cost. Present owner with a quantified accept/reject proposal before implementing a provider migration.

See `supabase-poc/tests/` for repeatable *rollback-only* test SQL. Keep this experiment separate from issue #858 Calendar performance and Mosaic's pre-1.0 production release plan.
