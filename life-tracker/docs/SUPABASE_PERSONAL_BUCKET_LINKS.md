# Source-only owner-private Bucket List and task-link migration (#1027)

**Status (2026-10-25): no hosted SQL/table, sync transport, RxDB writer or live
migration exists.** This mapping and referential-integrity contract is a
pre-social data-preservation gate, not a feature release.

- The source Appwrite/RxDB `BucketListDocument` has an immutable legacy ID,
  title, description, achieved/achievedAt, created/updated dates and soft
  tombstone. The source `BucketTaskLinkDocument` stores a separate stable ID
  and exact `bucketListId`/`taskId` references, dates and soft tombstone.
- `candidateBucketMapping.ts` maps these without rewriting values,
  attaching server-controlled revisions or assuming that the Appwrite account
  identifier equals a Supabase Auth UUID. Both source and remote owner IDs
  must match an **independently verified** owner mapping.
- Historical Appwrite task IDs can be longer than candidate task IDs.
  A link's `taskId` is preserved up to the original schema maximum (255);
  forcing a 36-character future task ID would silently lose history.
  **A long original task reference is quarantined, not imported as ready,**
  until a separately verified target-ID mapping preserves its meaning.
  No cross-owner relationships are ever allowed.
- `classifyCandidateLinkReferences` returns **ready**, **quarantined** or
  **tombstone** given the signed owner's complete source target inventory.
  Missing, foreign or deleted linked tasks/bucket items are *quarantined*,
  NOT auto-deleted or silently rewritten; intentional link tombstones stay
  tombstones. Existing data should remain in a private export/ledger until
  every target is accounted for.

## Required before hosted or public acceptance

Implement two reviewed private SQL tables, authenticated owner-only
RLS, expected-change-revision CAS, owner-linked referential guards and
signed local GoTrue two-owner/foreign-negative tests. Decide how to represent
historical dangling/task-ID references without violating owner isolation,
then extend encrypted database/Auth/Storage offsite capture and isolated
restore profile to all ten personal data tables, including task links.
Add owner-scoped pull/create/CAS, RxDB checkpoints and conflict reviews;
prove full ZIP/offline/reimport parity and a fenced, reversible provider
migration. **Never apply a hosted schema before full data DR coverage.**
No further Fedora command until the full one-pass pre-social bundle.

## Unapplied two-table SQL candidate (draft; NOT accepted)

The isolated source branch stages `supabase-poc/migrations/20261025_candidate_private_bucket_links.sql` with owner-private Bucket List and ready task-link tables, composite (owner, target ID) foreign keys, authenticated owner-only read/create RLS, writer-lease/revision triggers, and strict expected-revision CAS for mutable fields only. No direct client UPDATE/DELETE and no reference redirection are granted. The accompanying catalog assertions are source-only until executed against disposable PostgreSQL.

The 255-character historical Appwrite task references are not coerced to candidate task IDs; incomplete, foreign, deleted, or long target references remain in an external encrypted quarantine inventory. A link cannot be inserted as ready unless its same-owner bucket and task already exist, with short compatible IDs. **Next gate:** wire these files into disposable local migrations, run signed two-owner/negative RLS and CAS tests, and implement ten-table encrypted exact-byte source-to-fresh-restore checks. Only then consider hosted installation. No application writer is enabled.
