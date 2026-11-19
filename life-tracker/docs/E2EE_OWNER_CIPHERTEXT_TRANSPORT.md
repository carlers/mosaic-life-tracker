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
