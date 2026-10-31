# Cloud media lifecycle safety contract — #1478 (Phase 3)

**Status:** Phase 3A pure classification and Phase 3B bounded read-only server audit are
implemented on an isolated Preview branch. There is **no cloud cleanup action**,
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
Even a complete read-only snapshot cannot rule out an offline PWA replay or a
concurrent upload by itself.

## Required backend evidence (not currently available)

1. Durable, server-controlled file ownership/provenance index for every upload,
   with an explicit legacy/unknown migration path. Client file ACLs alone do
   not establish historic ownership. No browser admin credentials.
2. Canonical reference graph across active and tombstoned task/Diary/profile
   records, current and legacy chat media where relevant, shared records,
   backup/restore flows, queued uploads, and cross-owner references.
3. Bounded, cursor-stable exhaustive pagination with verified completeness;
   stale/offline clients and per-account writes must be fenced. Partial,
   malformed, missing or unknown status is protected, not reclaimable.
4. Durable mark/grace/recheck/sweep protocol with per-file idempotent receipt,
   CAS/reference-generation check, old-client replay protection, worker
   crash-after-each-stage recovery and explicit retention decision. No grace
   period has been selected; do not invent one. A separately reviewed trusted
   worker must revalidate provenance, current authorization and all references
   immediately before any physical deletion.
5. Scratch three-account cross-owner denial, friend-readable task and private
   Diary cases, old-client/PWA and 90-day recovery, multi-device, revoked
   grants, in-flight uploads, restoration/erasure consistency and DR tests.
   Appwrite Scratch changes use the documented managed migration/Function
   gates with isolated disposable data; none are part of this slice.

## Sequencing

- **3A (this task):** non-mutating decision policy and handler-level tests;
  record gaps, no version bump (no user-facing or deployed service change).
- **3B (separately verified):** read-only server-owned inventory/provenance
  and reference-coverage design, additive compatible backend plan and
  authenticated Scratch tests. Never expose orphan classification without
  sufficient proof or count unknown media as reclaimable.
- **3C (requires explicit review and authorization):** narrow attachment
  unlink workflow, then a durable worker. No automatic orphan sweeps, bulk
  cloud deletion or account-wide clear shortcut by default.

The read-only Phase 2 client scanner in `src/lib/cloudMediaUsage.ts` remains
unchanged and is not a deletion authority. See `DEVICE_STORAGE.md`,
`ACCOUNT_ERASURE.md`, `TOMBSTONE_RETENTION.md`,
`CLIENT_BACKEND_COMPATIBILITY.md` and issue #1478.

## Phase 3B — server-side read-only reference/ACL audit

`appwrite-functions/message-action/owner-media-audit.js` implements
`get_owner_media_audit` through the existing trusted Function router, using
only the platform-verified `x-appwrite-user-id` caller. It rejects mismatched
requested owner IDs before remote queries. It scans server-side owner-filtered
task/Diary/settings rows **including tombstones**, and bounded bucket metadata.
The bucket scan never returns names or file IDs to the caller, never returns
unrelated files, and only considers files with exclusive owner update+delete
grants. Friend-readable `read(users)` does not make a file owned. Duplicate
references count once; pending local images and malformed metadata are noted.

Output separates owner-ACL-controlled live references, tombstoned references
and **unreferenced-but-unverified** entries. None are billed totals or confirmed
reclaimable storage. In particular, even if a file has only this user's update
and delete permissions, old clients and missing upload provenance mean it
cannot be deemed a deletable orphan.

Every response is `deletionAuthorized:false`, `complete:false`. Unknown
data, an incomplete backend-wide file scan, missing/invalid metadata and
unresolved app clients are explicitly marked. Pages are capped to avoid
unbounded global bucket work. The scan is **on-demand** and has no
startup subscription. This is a technical Function contract only; Scratch
Function activation, an authenticated browser consumer and device acceptance
remain gated. Old Function handlers remain unchanged.

