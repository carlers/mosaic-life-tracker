# Encrypted Supabase archive: metadata-only inspection

Scope: isolated `mosaic-dev` logical backup under #1027. This tool inventories
a **private local** age-encrypted `pg_dump -Fc` archive without restoring it,
writing plaintext to disk, connecting to hosted PostgreSQL, or revealing row
contents. It is not a backup-restore acceptance test.

The raw archive contains Supabase-managed definitions. Replaying every TOC entry
into an initialized Supabase database attempts privileged changes to
`realtime.list_changes` and fails. Do **not** elevate roles, bypass the
transaction, or replace native managed Auth/Realtime/Storage objects.

In the trusted Fedora checkout, after updating the isolated branch:

```sh
cd ~/mosaic-supabase-backup/life-tracker
bash supabase-poc/inspect-encrypted-backup-toc.sh \
  "$HOME/mosaic-secure-backups/mosaic-dev-20261022T031628Z.age" \
  "$HOME/.config/mosaic/supabase-backup.agekey"
```

The report contains only TOC counts and known required-object names, with no
per-owner IDs, email addresses or row values. It fails when the required
`public.mosaic_candidate_tasks`, `public.mosaic_candidate_categories`,
`auth.users`, `auth.identities`, `mosaic_candidate_private.core_authorities`,
or `mosaic_candidate_private.owner_revisions` data-entry metadata is absent.
These six recovery-critical data objects are counted without printing raw TOC
entries. Auth session data presence is reported but not required: stale sessions
and refresh tokens must not be presumed reusable after new Auth/JWT setup. A matching report **does not**
prove the archive can restore users, passwords, table data, RLS, RPC or service
config. Keep both snapshot and private key offline; **never upload either**.

## After the six-of-six metadata pass

A real Fedora inspection on 2026-10-22 returned `METADATA_ONLY_NOT_RESTORED`
with 707 TOC objects, 75 Mosaic-owned definitions/data entries, 9 Mosaic
data entries, 537 managed platform entries, 6/6 required data entries
present, and **zero** restores. This is an inventory success, NOT recovery.

Use the newly added **offline decode-only** step. It authenticates the
entire ciphertext again, builds a temporary six-table DATA-only TOC selection,
and makes `pg_restore` decode the selected SQL directly into `/dev/null`.
The selected TOC is deleted by the script. No DB host, SQL client, connection,
plaintext archive file or user-row output is required:

```bash
cd "$HOME/mosaic-supabase-recovery-review/life-tracker"
git pull --ff-only
bash supabase-poc/check-private-archive-data.sh \
  "$HOME/mosaic-secure-backups/mosaic-dev-20261022T031628Z.age" \
  "$HOME/.config/mosaic/supabase-backup.agekey"
```

Share only the JSON report and the final `SELECTED_DATA_DECODE_PASS`
line, or the short generic error message. The report names only *database
table identifiers* and counts, never row values, Auth identities, tokens or
passwords. `otherMosaicDataObjects` must be reconciled before any later
real restore; the six selected tables are a **minimum test subset**, not a
complete safe backup manifest. Auth sessions and refresh-token data are
intentionally excluded from this decode selection, not silently declared
reusable. The script does **not** validate foreign keys, restored passwords,
role grants, RLS, Realtime, SMTP, Storage or provider configuration.

The native local Supabase `postgres` database at `127.0.0.1:25077` must
remain untouched by this step. A following independent data-restore drill
requires a separately checked empty/initialized disposable target, complete
column compatibility and a reviewed dependency-ordered object allowlist.
Never point an unfiltered `pg_restore` at an initialized managed Supabase
database or request superuser to bypass permission failures.

Next recovery step: construct and test an explicit object-level restore allowlist
against a disposable *initialized* Supabase instance, with Auth account/related
table dependency ordering and signed two-owner verification. Review exact
archive TOC privately before choosing any target object. The script deliberately
creates **no** `pg_restore --use-list` file or writes into a database.

Reference: https://supabase.com/docs/guides/self-hosting/restore-from-platform
