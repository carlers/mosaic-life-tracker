# Private Supabase Storage binary DR foundation (#1027)

Scope: **isolated Scratch** project `mosaic-dev` only, bucket
`mosaic-personal-photos`. This is NOT managed Supabase Auth, SMTP, scheduled
retention, restored-project readiness, production data migration or a release.

The existing age-encrypted PostgreSQL snapshot and seven-table restore **do not
contain Storage object bytes**. The hosted signed synthetic photo test confirms
owner/foreign/anonymous restrictions and one encrypted byte roundtrip, but does
not establish sustained recovery of all user photo objects.

## Source-read-only binary capture

`private-photo-snapshot.py` is an opt-in operator/local-job tool. It validates
the fixed Scratch Storage source, lists all owner UUID folders via the official
Storage API with bounded pagination, rejects unexpected nested paths or
non-WebP objects, downloads every enumerated object's original bytes, and
compares a second complete metadata inventory against the first. It encrypts
the streaming tar archive and last-entry manifest through `age` using the
**existing local escrowed identity**, then decrypts the complete candidate
and validates every object SHA-256 and byte count before publishing the output
using a no-clobber hard link. No plaintext archive is written to disk.
Failure removes the unpublished encrypted partial; it never deletes, updates
or creates cloud objects.

The tool requires a **dedicated backend-only** source `sb_secret_...` API key
(or legacy service-role JWT) in
`MOSAIC_SUPABASE_SOURCE_STORAGE_KEY`, supplied privately on a trusted operator
machine or later a protected runner. Never put it in a browser, Vite `VITE_*`
variable, GitHub issue, terminal history, repository file, or chat. The script
does not retrieve privileged credentials from Supabase management access.
Modern opaque keys are used only in the `apikey` header, not a bearer JWT.
A private 0700 output directory and a preexisting 0600 age identity are required.

**The 2026-10-24 synthetic fixture is already cleaned**: the authenticated Storage API DELETE returned 200, and connected read-only management confirmed zero objects. Do **not** ask the operator to repeat cleanup. The one-command protected-key snapshot wrapper is documented at [operator protocol](../docs/OPERATOR_ONEPASS.md). When a dedicated backend-only server key has been privately provisioned:

```bash
# On trusted operator host only. Source secret must already be in a private
# process environment; never paste the key into these command arguments.
python3 supabase-poc/private-photo-snapshot.py \
  "$HOME/mosaic-secure-backups/mosaic-dev-photo-$(date -u +%Y%m%dT%H%M%SZ).age"
```

Success prints `SUPABASE_PRIVATE_MEDIA_ENCRYPTED_SNAPSHOT_PASS` with only
aggregate object count and total bytes; zero objects proves only an empty
inventory and encrypted-manifest roundtrip. The script refuses changed
metadata inventory, unknown paths, oversized objects, network/age failures,
malformed/tampered archive, missing escrow identity and output overwrite.
It never treats an attempted download or a metadata-only `storage.objects`
query as successful binary recovery.

## Required before user-facing photo recovery acceptance

1. Establish a guarded scheduled source snapshot and independently durable
   encrypted-copy retention, using the existing DR policy as a candidate
   (seven daily/four weekly/six monthly), immutable completed markers,
   protected runner secrets, failure alert and periodic restore drills.
   Monitor backup freshness and avoid pruning the last good copy on failure.
2. Restore an **encrypted** known nonempty image set into a separate isolated
   Supabase target with a different explicit project ID. Verify byte SHA-256,
   counts, path ownership, bucket configuration, signed access/foreign denial
   and app render. Do not overwrite existing files, replay old writers/sessions,
   or use the source project's privileged credential on the target.
3. Reconcile Storage object names/bytes against owner-private Diary/task image
   references and frozen historical Appwrite images; account for records
   missing from the seven-table database recovery. Establish reversible
   source/target delta handling and old-PWA writer fencing before cutover.
4. Gate protected Preview approval and any dev/main or Production promotion
   on the relevant signed tests, mobile/manual acceptance and explicit owner
   release approvals. This source-only foundation changes none of those gates.

Offline unit checks are wired into Vitest as
`tests/unit/supabasePrivateMediaSnapshot.test.ts`. They verify the tar/manifest
byte contract, live-inventory mutation refusal, key routing, and path security.
They do not exercise live privileged access, real age process execution,
scheduled storage, or a separate-target restore.
