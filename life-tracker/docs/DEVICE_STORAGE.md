# Device storage management — #1476

The first version of Storage lives under Settings → Data & Sync and loads only on that route.

## Account and data boundaries

- Browser `navigator.storage.estimate()` usage/quota is an approximate **origin-level** report, not available device space or an account allowance. The page separately measures `mosaic_image_cache` downloaded Blob bytes and only the signed-in owner's staged pending-image uploads. The three numbers are independent, not additive.
- Image cache is currently **device-wide**, keyed by file ID and limited to 50 MiB. Its usage and clear action explicitly apply to all accounts on this browser. Do not advertise them as per-account. Image cache content can be refetched only when the authorized remote original remains accessible online.
- Pending `mosaic_pending_images` entries are owner-tagged and must never be deleted by routine cleanup. They contain the only available upload data until sync completes. RxDB, sync metadata, outboxes, PWA assets, local-only data and authenticated cloud files are outside the clear action.
- The browser may deny persistent storage or evict it despite app requests. Unsupported APIs must display **Unavailable**. The page is informational and cannot guarantee persistence.
- Clear cache uses only the separate `clearAllCachedImages` IndexedDB transaction. It is idempotent. Other tabs/image loads may repopulate it after clearing; report the refreshed measured result rather than assuming a permanent zero.
- `Clear Local Data` is a distinct destructive Settings action and remains unchanged in Phase 1. See #1477 and #1478 for separately gated cloud inventory/deletion.

## Acceptance boundaries

Unit test browser-estimate fallbacks and owner-scoped pending data; DOM test confirmation/no unrelated store changes. Validate cache clearing, offline PWA opening, cached-photo loss/re-download, account switch, concurrent tabs and pending uploads on a physical device. CI/Preview evidence must be recorded before marking accepted. A clean browser estimate never substitutes for queued-sync health.

## Phase 2 — read-only, owner-referenced cloud media

On explicit user request, the Storage page may query the authenticated owner's current
synced task, Diary and profile-setting rows, then retrieve metadata for **only** the
referenced, owner-controlled Appwrite photo files. Appwrite `read(users)` is **not**
ownership; require an owner row and explicit owner update/delete file grants.
No bucket-wide `listFiles`, friend/shared media projection, image download or
server mutation is permitted.

Displayed bytes are a **verified referenced-media subtotal**, not a cloud billing
measurement, account allowance or exhaustive inventory. Files without a live
reference (orphaned/archived files), pending offline uploads, future chat media and
storage-provider overhead are excluded. The scanner must bound rows, pages,
concurrent metadata requests and file IDs; show unknown/failed and truncated
status rather than silently calling incomplete results exact.

Scans now accept a cancellation signal; account switches and page unmounts abort
the scan. The Appwrite browser SDK cannot abort requests already in flight,
but the scanner rejects their results and stops issuing new requests. The
authenticated owner is revalidated between table pages and before/after file
metadata scans. A cancelled scan must never publish its partial subtotal.

The feature does not provide deletion. Complete account-wide cloud storage inventory
requires a separately reviewed server-authoritative owner index or endpoint,
three-account Scratch privacy acceptance and the normal backend gates (#1477).
Permanent file deletion is separately deferred under #1478.

## Phase 3C — safe task photo detachment (Preview only)

Removing an existing task photo changes the authenticated owner's current local
task reference by a conditional, atomic RxDB modification. It rejects stale
photos, foreign/deleted rows and absent tasks before modifying anything.
Neither the action menu nor the image picker calls browser Storage deletion.
A remote cloud file is **not** deleted, and no reclaimable bytes are claimed.
The unreferenced file remains protected pending a future reviewed server-owned
reference/provenance ledger, offline-client fencing, grace/recheck and worker.

Pending offline photo blobs are also preserved; deleting their only known copy
before successful cross-record/queue cleanup could cause unrecoverable loss.
Existing older installed PWAs can still execute historical direct-file-delete
code, so this frontend containment is not a backend-enforced global guarantee.
The non-destructive read-only server audit is separately tested on an isolated
Phase 3B Preview and is not activated in Scratch.

For physical media deletion, first prove authoritative upload ownership, all
current/legacy references and stale-client write fencing, then separately
authorize a trusted idempotent server action with crash/retry and restore tests.
Do not activate automatic orphan sweeping, bulk cleanup, or direct client
Storage deletion based on these frontend safeguards. See #1478.
