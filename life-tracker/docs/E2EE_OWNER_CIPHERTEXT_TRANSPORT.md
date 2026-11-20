# M2 owner-only ciphertext staging — Scratch and source only

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
