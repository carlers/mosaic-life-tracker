# Private Supabase PG17 core data restore — operator-owned, isolated (#1027)

**Scope: the single privately authenticated Fedora snapshot from 2026-10-22.**
Its offline audit has successfully decoded and counted 54 TABLE DATA objects
(1,410 rows) and no database has been restored. All six core table row
counts exactly match the earlier read-only hosted mosaic-dev snapshot:
`auth.users=81`, `auth.identities=81`,
`mosaic_candidate_private.core_authorities=81`,
`mosaic_candidate_private.owner_revisions=49`,
`public.mosaic_candidate_categories=53`,
`public.mosaic_candidate_tasks=58`.

## Recover into a truly separate initialized target

Once the **Real GoTrue Restore Lab** on the current isolated candidate SHA has
passed its new six-table exact-row-contents comparison, run on the trusted
Fedora machine:

```bash
cd "$HOME/mosaic-supabase-recovery-review/life-tracker"
git pull --ff-only
bash supabase-poc/run-private-core-recovery.sh \
  "$HOME/mosaic-secure-backups/mosaic-dev-20261022T031628Z.age" \
  "$HOME/.config/mosaic/supabase-backup.agekey"
```

The operator needs local Docker with a **Unix-socket daemon**, Linux, Python 3,
age, and the Supabase CLI; PostgreSQL 17 `pg_restore` is run only **inside**
the verified disposable PG17 container, never via the operator's host
`pg_restore` version. The script refuses remote
Docker contexts, external PG/Supabase credentials, an altered archive SHA,
unexpected source row counts, incorrect target identity, nonempty target
tables, a PostgreSQL version other than 17, missing schemas, externally
published container ports and any mismatch of restored row contents.

It creates a **new hidden 0700 local project directory**, random project ID
starting `mosaic_dr_`, and separate autoallocated local ports. It creates a **unique Docker bridge**
with `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` and uses
`supabase start --network-id`, following
[Supabase's loopback-only local-development guidance](https://supabase.com/docs/guides/local-development).
It checks that *every* newly created published container port is bound only
to loopback **before decrypting the private snapshot**. If the CLI ignores
the network binding, the script refuses to load data and destroys the new
stack. It bootstraps
a new Supabase CLI stack with only six reviewed core migrations and checks
the fresh target before decrypting anything. The user's existing
`postgres:25077` target, other local Supabase stacks, hosted `mosaic-dev`,
Vercel and Production are not touched.

The private archive is authenticated and held in bounded anonymous Linux
memory, then transferred only to the verified local Docker container's
`/dev/shm` tmpfs for seekable `pg_restore`. No source archive plaintext
is written to host disk or uploaded. Only **six TABLE DATA** objects are
restored in dependency order to the newly initialized schema. Supabase-managed
tables, definitions and their original Auth sessions and tokens are not
replayed. Managed Auth triggers remain enabled; application-only task/category
triggers are temporarily disabled for exact historical rows and reenabled.
Archived canonical owner authorities **including all frozen records** are
preserved. It verifies all six row counts (81/81/81/49/53/58) from the actual
source COPY blocks **inside the PG17 container**, then every source/target COPY row
**byte-for-byte after order-independent comparison** without displaying
private row values, email addresses, owner IDs, passwords or hashes.
The source archive is preserved and all temporary container plaintext is
deleted at exit.

Failure stops/removes **only the newly generated disposable stack** and its
temporary directory. Success leaves the private stack running and prints
its unique directory and loopback API address for subsequent manual signed
verification. The operator must keep the lab private and not deploy it.

## Explicit boundaries — not complete DR acceptance

The source also has 2 historic `beta_signup_invitations` entries and 150 old
`core_sessions` writer leases; both remain safely preserved in the original
encrypted snapshot but **are intentionally not loaded or activated** in the
new core-only target. Three legacy/probe Mosaic tables were empty and remain
preserved in the source archive. The source has 184 Auth sessions, 226 refresh
tokens, 184 MFA session claims and 3 one-time tokens; **none are replayed**.
Auth/Storage/Realtime migration-history rows are managed by the fresh target,
not imported. Storage user objects/buckets were absent at source snapshot
time. If invite-only registration or active original sessions are release
requirements, this is NOT their recovery.

This verifies six core tables only. It does not prove that real users can
sign in (requires their known original passwords or existing verified provider
setup, no passwords shared with ChatGPT); that two owners' signed API calls
are private on the recovered instance; that **external Auth providers**, SMTP,
hosted JWT issuer, migration histories, archival invitations or Storage
service configuration are compatible; or that the current hosted state
still equals the snapshot. The local target intentionally requires fresh
Auth sessions and invalidates old JWTs. Keep full issue #1027/#1029/#857
acceptance and rollout gates open until those checks pass.

After a successful rehearsal, privately sign in to the printed local API
with an existing non-frozen account and verify category/task records, then
test a separate fresh signed account for isolation. Do **not** share
credentials or raw responses. The real-data source and all historical
records remain encrypted and intact regardless of the outcome.

To stop the successful disposable stack when finished, run
`cd <PRIVATE_LOCAL_DIRECTORY>` using the exact path printed locally, then
`supabase stop --no-backup`. Then remove only the **exact**
`PRIVATE_DOCKER_NETWORK` printed by the operator command with
`docker network rm <PRIVATE_DOCKER_NETWORK>` once that stack is stopped.
This discards the local rehearsal; it never deletes the original encrypted
backup. The private directory can then be removed only after verifying its
exact path and no other project data.
