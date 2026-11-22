# M2 owner-only ciphertext staging — Scratch and source only

## M2 shared private-write preflight — 2026-11-22

The existing shadow migration rejected public/inherited visibility and
plaintext media references, but the lower-level owner ciphertext writer
could be called independently without those same checks. A single
`ownerPrivateWritePolicy` source gate now rejects unsafe inputs for **both**
shadow migration and direct encrypted mutation preparation, before any
ciphertext operation is queued or sent. It rejects wrong owner/document IDs,
unknown fields, public/follower/missing visibility for tasks/categories/Diary,
legacy media references, media-related settings keys, unsafe routing values
and oversized record payloads. The ciphertext-only outbox and raw commit path
independently reject public/nonprivate routing even if a caller constructs an
encrypted mutation manually.

Unit coverage round-trips all six currently staged owner-private domains
(tasks, categories, Diary, Bucket List, Bucket List links and safe settings)
with real client WebCrypto, verifies semantic IDs and private content never
appear in the wire record, and exercises wrong-owner, media, metadata and
manual-outbox bypass negatives. This is a source-level staging invariant;
missing backend ACL inspection, old-PWA plaintext-writer closure, valid
snapshot provenance, future encrypted media references, and live Scratch
owner-transport activation remain separate blockers. No legacy data is
rewritten, deleted, cut over or deemed encrypted by this change.


## M2 isolated Scratch source boundary repair — 2026-11-22

Live app/ops inspection confirmed E2EE Scratch project `6b00671500279e901846`,
while ordinary Preview remains project `6ae94a2100014d01f5ed`. Four legacy
M2-adjacent source paths still accepted the old Preview ID rather than the
isolated Scratch ID: the owner RPC, owner table migration, private media
bucket migration, and synthetic Diary table migration. All now permit **only**
the isolated Scratch project; targeted tests explicitly prove the normal
Preview, TEST and Production IDs are rejected before any network request.
The client additionally requires the pinned Appwrite endpoint and owner scope.

The synthetic Diary migration was additionally hardened: a successful table
creation POST is not proof of safety. It now requires an independent full
readback of empty table-wide permissions, enabled row security, all expected
columns/indexes and table identity, refusing missing ACL fields, partial
schema, or unverified post-create state. The owner and media migrations
already required independent schema/ACL readback. No migration was executed
by this source repair.

Read-only Oracle Scratch broker status reports the two M2 owner tables with
six and ten columns, respectively, and both `task_images` and the
`private_owner_media_v1` bucket present. Its bounded summaries **do not
expose sufficient ACL or encryption settings** to verify table-wide/row
permissions, bucket security or full migration identity. The bootstrap
worker reports `media_ready`. The existing Function is authorized only for
the separate single-synthetic Diary pilot, and general `e2ee_owner_v1`
remains default OFF. This is an environment-routing and fail-closed source
gate, **not M2 activation**. No existing data, Function deployment, media,
legacy writer, old PWA or general Preview backend was changed. Do not issue
M2 owner/media mutations until authoritative restricted-ACL and live
Function readiness gates are satisfied.


This candidate defines two **new**, server-only tables: `account_crypto_roots_v2`
and `private_owner_ciphertexts_v1`. The generic E2EE root is deliberately
isolated from the synthetic Diary pilot's older incompatible account-root
domain. A root envelope is always encrypted on the browser; the server has
owner-routing metadata, never the recovery secret or data root.

**Migration 028** is explicitly opt-in (`--only 028-e2ee-owner-staging`)
and rejects any project other than the pinned disposable Oracle Scratch ID.
Both tables use row-level access control and **no table create/update/delete
permissions** for browsers. When a Function creates a row it must grant only
owner-row read permission. Default migration runs exclude migration 028.

**Security gate:** A table alone does NOT close legacy direct writes to
`tasks`, `diary`, `settings`, `categories`, `messages`, or the
`task_images` bucket. Those paths remain plaintext until all affected
client writers, old signed-in PWAs and row/file ACLs are reconciled with
a tested, resumable migration and an explicit account cutover.

The owner-record transport is limited to user-private domains. Social,
chat, shared tasks and public publishing require independently authenticated
recipient keys and separate protocol work (#2085). Storing opaque ciphertext
in this table does not imply that other server-side notifications, search,
analytics or historical disaster-recovery snapshots are encrypted.

No live Scratch schema or Function change is asserted by this document.
Migration/readback tests and synthetic quotas must pass before activation.

**Owner ciphertext Function source:** The opt-in `e2ee_owner_v1` action adds atomic owner-root create/recovery-CAS and strict private-record create/get/list/CAS. It is **disabled by default** and refuses every operation outside exact Oracle Scratch and explicit synthetic MFA/owner allowlist. A separate table namespace prevents the old pilot root domain being reused accidentally. Server validates only allowlisted routing metadata, rejects `published` and unknown document fields, and never receives raw content or recovery secret. It accepts only owner-private records, not chat/shares. No active Function change or database mutation is claimed. The disabled Function code still needs backend and browser tests before an activation decision.

**Shadow migration preflight (M2):** A new source-only staged migration accepts only an explicitly complete/fresh, owner-scoped snapshot of all six owner-private collections and a memory-only root. It rejects public/follower visibility, any current plaintext file references, unclassified fields, duplicate/oversize records, partial collections and batches larger than the protected outbox's bound. Already-encrypted records are read back and AEAD-decrypted; mismatches abort. New records go to the ciphertext-only outbox *before* remote writes, with readback verification and idempotent replay. It never mutates legacy plaintext tables, makes cutover decisions, or rekeys a compromised account. Source fingerprint is not a substitute for signed/atomic server cutover or old-PWA fencing. The network replay path cannot be exercised on Scratch until its disabled Function is deployed and migrated with correct ACLs.

**Live Scratch schema creation checkpoint (2026-11-20):** Using exact isolated Oracle Scratch `life_tracker`, the typed Oracle broker accepted creation (HTTP 201) of the two new tables, all 16 required columns (HTTP 202), and both requested indexes (HTTP 202). Readbacks: 2 tables present, six root columns and ten owner ciphertext columns; all 16 independently inspected as `available`, required, with matching types; index listings each contain one index. **Still unverified**: complete table/row ACLs and index uniqueness (broker's read summaries omit those fields), full application Function deployment (`message-action` reports `live:false`), synthetic MFA operation, and legacy-write floor. No owner records were migrated or exposed. The dedicated migration 028 remains opt-in and the new endpoint disabled by default. Do not activate any protected write path until the restricted permissions and source-deployment SHA can be read back authoritatively.

**Private media source-only codec (M2):** New browser WebCrypto AES-256-GCM codec encrypts supported compressed image Blob bytes before any future remote media upload, deriving an independent key for each random 128-bit opaque media ID and authenticating every fixed-size chunk, immutable owner/project/key ID, sizes, count, order, and MIME metadata. MIME is encrypted; ciphertext file size and chunk count are disclosed. It rejects modified, truncated, swapped, cross-account, wrong-root and unsupported HTML/SVG image payloads. 12 MiB bound, 64 KiB chunking, one-pass in-memory media encryption and independent crypto tests. This **does not authorize any existing Storage upload**: a dedicated ciphertext-only bucket with server-side upload acceptance/ACL and migration of historic media is still required. Do not replace current `saveTaskImage`/`saveDiaryImage` while old client uploads and media Function routes remain plaintext.

**Cross-device staged owner page decryption:** The client can now read and AEAD-verify a bounded 20-row owner/collection page from the disabled Scratch Function, compare deterministic opaque IDs against plaintext IDs stored inside the ciphertext, enforce strict owner/project/key/collection metadata, reject duplicate or nonmonotonic page cursors and reject scans beyond 500 records instead of pretending a partial result is complete. This is explicitly a **full bounded snapshot scan, not RxDB live incremental replication**. Appwrite's current server list orders by opaque row ID and cannot observe subsequent edits to rows before an earlier cursor; do NOT attach it as a live pull checkpoint until a reviewed monotonic update feed is implemented.

**Privacy correction (2026-11-20):** Shadow migration's old `sourceFingerprint` was an unkeyed SHA-256 of ordered private record values, which would be inappropriate to export or log because short titles and diary text are guessable. It now derives a domain-separated nonextractable HMAC-SHA-256 receipt key from the account root, scoped to project and owner; same snapshot and root reproduce the same receipt for interruption detection, while wrong root, owner and content differ. No raw private content, root or receipt is sent to a server. Receipt is still *not* a cutover/old-PWA write-fence or proof of backend migration success.

**M2 dedicated ciphertext Storage schema (source-only 2026-11-20):** Opt-in migration `029-e2ee-private-media` defines a separate Scratch-only `private_owner_media_v1` bucket with no browser-wide ACL, per-file security, a 12MiB+AEAD-tag hard size ceiling, only `.bin` opaque encrypted files, no server-side image transforms, compression disabled, encryption-at-rest as defense in depth, and antivirus disabled because it cannot inspect authenticated ciphertext. The encrypted client codec separately enforces permitted plaintext MIME and authenticates file/chunk metadata. The migration refuses any project except pinned Scratch, does not change the legacy `task_images` bucket, fails on any existing schema/permission drift, and requires a full authoritative GET after creation. **Not deployed:** current typed broker's bucket constructor cannot set/read back the full policy and using its truncated constructor would create an insecure/drifting resource. Wait for owner-installed Scratch Admin MCP. Uploads still require server registration/ownership and a ciphertext-only Function route before test.
