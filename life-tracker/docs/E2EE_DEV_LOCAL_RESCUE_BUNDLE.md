# #2084 source-only owner local encrypted rescue bundle — 2026-11-26

The dormant `ownerLocalRescueBundle.ts` composes the current-dev owner-only RxDB row/tombstone snapshot and orphan-inclusive pending-image ciphertext collector into one in-memory **root-encrypted, AEAD-authenticated** Blob with filename `mosaic-local-rescue-v1.enc`. Its payload includes only opaque row IDs, random revisions, encrypted record/media envelopes and ciphertext; no original task ID, date, notes, image local ID, MIME or plaintext photos. An independent AES-GCM manifest binds the exact file format/version and SHA-256 digest of the complete ciphertext row/media arrays and authenticated entry counts. A local verifier rejects wrong account/project/root, tampering/removal/addition, invalid media and duplicate decrypted entries, and decrypts all source rows and images without writing them.

It returns bytes only; it does NOT trigger download, save/reselect a physical file, install an old PWA patch, enumerate historical origin IndexedDB, include RxDB internal replication revisions/checkpoints, message/social queues, or restore anything to a sealed backend. The same-source two-pass reads detect observed changes, not arbitrary cross-tab ABA races. Export caps are deliberately bounded and may deny oversized accounts; denial must not be mistaken for an empty successful backup. Real cross-browser IndexedDB/file/restore, older PWA controller proof, complete media and idempotent import remain mandatory before any account cutover. No Appwrite, normal Preview, dev/main or Production writes.

## 2026-11-26 version 2 — authenticated owner pending actions included

Version `mosaic-local-rescue-v2.enc` additionally requires the read-only current-origin known social/message-action/friendship queue snapshot. The separate HKDF→AES-GCM pending-capsule bytes are bound into the root-authenticated outer manifest SHA-256 and pending count. Independent local readback must authenticate **all three** parts (owner records including tombstones and orphan links, owner pending images including orphan media, and known localStorage queued actions); removing a part, changing its bytes, forging counts, wrong owner/root or downgrading to v1 fails closed. No automatic import/replay or cloud writes. This is still not a historical installed-PWA binary/IndexedDB snapshot and does not preserve RxDB internal unsynced revision/checkpoint metadata or unknown earlier queue layouts. Saved-file and real-device acceptance remain required.

## Browser-backed saved-file readback rehearsal (synthetic only)

`tests/e2e/e2ee-local-rescue-browser.spec.mjs` exercises real Chromium IndexedDB `mosaic_pending_images/images` persistence, synthetic current-owner tombstone/orphan links and localStorage pending social action. After locally AES-GCM encrypting the v2 three-part artifact, it downloads via a user-clicked native anchor, persists that file in a test-only temporary directory, reloads the page, explicitly reselects the downloaded file, authenticates/decrypts the full saved file and checks that the orphan photo survived reload. Wrong owner fails and no Appwrite calls are permitted. The test verifies **only a new synthetic current-origin browser**; it does not prove old installed PWA controller/data access, absent sync checkpoints, real-owner MFA or safe restore.

## 2026-11-26 global final completeness recheck

Before an encrypted v2 bundle is returned, the builder decrypts authenticated owner rows and pending images and re-reads **all original source collections and staged photo bytes**, comparing complete record values, local IDs, creation metadata, MIME and SHA-256 photo contents. It also re-reads current pending social/message/friendship intents and compares them with the independently authenticated pending capsule. This catches edits to one source while the other sources are being sealed and refuses a misleading successful backup. Unit tests inject both late row changes and late photo-byte mutations. There is still no atomic multi-origin/multi-tab freeze, and a malicious ABA race could escape comparison; this is an additional fail-closed source check, not proof of complete installed historical PWA recovery.


## Read-only authenticated saved-file unpack (synthetic/current-origin)

The optional unpackVerifiedOwnerLocalRescueFile reads a user-selected encrypted bundle **exactly once** into a bounded immutable text snapshot and then verifies its AEAD manifest, complete SHA-256 ciphertext inventory, row/attachment counts and all individual owner-root envelope decryptions against that identical snapshot. Only after every check succeeds does it return original owner row documents (including any retained RxDB revision/deletion metadata), pending social/message/friendship actions and locally decoded photo Blobs **in memory**. Wrong owner/root, byte-length drift, missing components and ciphertext mutation fail closed. Neither data is uploaded nor inserted into RxDB/IndexedDB/Appwrite, replayed, cleared or logged. If the saved source originally lacked raw revision/checkpoint information, unpack cannot manufacture it; original installed PWA completeness and global cross-tab snapshot remain unverified. Existing synthetic Chromium test now validates the actual saved/reselected file's decrypted contents and pending orphan image rather than counts alone.

## 2026-11-27 origin rescue caller-snapshot hardening

Before awaiting MFA, RxDB, media IndexedDB or WebCrypto, the source-only full
rescue builder copies the account scope and 32-byte owner root. The file
verifier separately captures owner/root before awaiting selected File bytes.
Both use that identity and key across all nested section verification/final
source audits, and erase temporary key copies on completion. Unit regressions
suspend MFA and File.text, mutate caller-owned owner IDs and root bytes, and
verify original owner readback still succeeds while wrong owner fails. This
is local durability safety, not global source snapshot, current root/epoch
attestation, old installed PWA support or server-side cutover.
