# Cloud media lifecycle safety contract — #1478 (Phase 3)

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

## Phase 3B audit integrity hardening

The bounded read-only audit rejects pages containing missing or repeated row/file
identities, including duplicates across cursor boundaries. It also refuses to
publish a subtotal once the sum of individually valid file sizes would exceed
JavaScript's safe integer precision. Both faults produce the existing generic
server error without partial file inventories; no write or deletion occurs.
A failed audit is not evidence of empty or reclaimable storage.


## Phase 3D — integrated source and old-client fencing boundary

The audited Phase 3B server source is forward-ported from its separate stable
Preview into the newer v0.60.0 safe task-photo detach Preview without replacing
newer chat/Diary privacy routing. The authenticated audit remains read-only:
no browser caller is registered, no database writes or new schema are created,
and no backend Function was activated as part of source integration.

The **upload provenance gate is still absent**: legacy clients can upload
directly to the authenticated-user-create Storage bucket; the Function cannot
trust that a same-user ACL proves who uploaded or that its reference graph is
complete. An additive owner ledger alone cannot fence older/offline client
upload, 409 conflict recovery, backup restoration, or stale reference writes.

The required production-safe order is (a) introduce trusted server-mediated
upload paths and owner ledger, with idempotency tied to a scoped owner/file
pair and verified Storage metadata; (b) dual-write/verify the task/Diary/chat/
settings reference graph and record server-owned reference revisions; (c)
remove unrestricted legacy browser create/modify/delete pathways only after
supported-client compatibility, offline queue, 409 retry and restoration
rehearsals; (d) distinguish pre-ledger files as legacy/unknown indefinitely
unless provenance can be independently verified; (e) private synthetic owner,
friend, and stranger tests with stale client and crash/resume across mark,
grace, recheck and deletion receipt. Owner consent and a separately approved
backend rollout precede destructive actions. Deletion is **not** inferred from
unreferenced ACL totals or tombstone retention periods.

The current supported policy intentionally never claims completeness or
authorizes a delete, including when all current rows are scanned.

## Phase 3E — server-minted upload identity foundation

Migration `017-media-uploads` creates the private, server-owned `media_uploads`
provenance table. Browser table permissions are empty; the Function is the only
writer. `reserve_media_upload` mints an unguessable one-hour upload file ID
bound to the authenticated caller and one of task/Diary/profile/chat purposes.
`confirm_media_upload` checks the original reservation, fresh Storage
metadata, owner-exclusive write/delete permissions, media type and size, and
atomically marks the reservation verified. Retries are idempotent and recheck
Storage metadata. The authenticated user ID is taken exclusively from the
platform Function header; user-provided owner IDs are ignored. No user-supplied
file ID may create a reservation.

**Neither reservation nor verification authorizes file removal.** They are
future-upload provenance only. Old/unknown uploads remain unverified, protected
and outside every cleanup scan. This stage does not yet change the existing
browser upload paths or supported offline-client requirements. The current
bucket keeps its legacy `create("users")` permission until a separately tested
old-client/queued-upload cutover, and the Function does not delete files.
Reference revision fencing and the complete cross-owner graph remain absent.

The durable account-erasure worker also queries `media_uploads.owner_id` as
a private cross-reference and removes the reservation ledger for erased owners.
This avoids preserving account identifiers after deletion; erasure's existing
DR privacy marker must still be acknowledged before any deletion.

## v0.65.0 reconciliation on latest development source (Scratch only)

The read-only Phase 3 audit, private server-minted upload reservations and
non-destructive reference-first task photo removal were forward-ported onto
v0.64.0 rather than replacing newer private Chat photo authorization or
public bug-report routing. The additive migration is **020-media-uploads** here,
not the earlier standalone 017, because 017–019 now belong to independent
Chat/Bug Reports backend changes. The live Scratch ledger was already created
with the same fields and private ACL; the migration must remain idempotent.

The existing shared `message-action` Function is the only permitted test
Function on the Scratch Free plan; `dr-backup` must remain for erasure/DR.
Any Function deployment uses a staged inactive source from the **integrated**
Preview SHA, checks that newer actions are retained, and does not change
Production. Registry `reserved` or `verified` is diagnostic proof about a
specific newly minted ID, never cleanup authorization. Browser direct creates
and old offline clients remain supported and their uploads **unverified**.
No automatic sweeper is added and older unverified files are retained.

Task image removal first atomically clears an owned record's exact expected
image ID, then closes the UI. It neither deletes the cloud file nor clears
pending offline image data. File deletion, reclamation totals and global
retention inference are disabled until canonical reference generations,
old-PWA fencing, and mark/grace/recheck/receipt have passed live authorization
and crash/restore acceptance.
