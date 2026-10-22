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
`public.mosaic_candidate_tasks`, `public.mosaic_candidate_categories`, or
`auth.users` data-entry metadata is absent. A matching report **does not**
prove the archive can restore users, passwords, table data, RLS, RPC or service
config. Keep both snapshot and private key offline; **never upload either**.

Next recovery step: construct and test an explicit object-level restore allowlist
against a disposable *initialized* Supabase instance, with Auth account/related
table dependency ordering and signed two-owner verification. Review exact
archive TOC privately before choosing any target object. The script deliberately
creates **no** `pg_restore --use-list` file or writes into a database.

Reference: https://supabase.com/docs/guides/self-hosting/restore-from-platform
