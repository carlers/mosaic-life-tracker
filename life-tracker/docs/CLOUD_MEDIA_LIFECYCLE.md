# Cloud media lifecycle safety contract â€” #1478 (Phase 3)

**Status:** Phase 3A pure classification and Phase 3B bounded read-only server audit are
implemented on isolated Previews and now integrated as a single source candidate
with Phase 3C reference-first photo removal (not yet deployed to the shared Function). There is **no cloud cleanup action**,
no new schema, no scheduled worker and no Production changes. Phase 2 remains
the only user-visible cloud-media feature. The Phase 3 audit action is not
activated in Scratch and is not called from the browser. Neither the classification
kernel nor the read-only audit can authorize deletion.

## What this first slice establishes

`appwrite-functions/message-action/media-lifecycle.js` builds a strict
owner-reference index from owner rows (task image, Diary photos, profile setting)
and classifies *hypothetical* file evidence as one of:
`live-referenced`, `pending-upload`, `pending-removal`,
`shared-referenced`, `unknown-protected`, `orphan-candidate`.
A tombstone protects its image even if the row is not currently visible.
Malformed JSON, inconsistent ownership, missing account metadata, incomplete
pagination or an unrecognized file ID fail closed. Multiple references do not
create multiple owned files. Friend-readable ACLs never establish provenance.

**Every result has `deletionAuthorized: false` and `action: 'preserve'`.**
An orphan-*candidate* is a diagnostic state, not permission to delete.
Even a complete read-only snapshot¶»§q«^