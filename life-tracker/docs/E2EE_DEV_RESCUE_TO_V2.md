# Strict offline rescued-owner to v2 staging boundary

Tracking app #1662/#2084. Dormant source-only entry point `stageAuthenticatedScratchRescueFileV2` takes the **actual saved encrypted file**, verifies and decrypts the entire same-project root-authenticated manifest, and only then bridges to first-write-wins HMAC-authenticated IndexedDB plans. The plaintext-object staging helper is intentionally private to this module; a caller cannot assert that an arbitrary unpacked object was verified. No Appwrite requests, remote receipts, account migration, queue/media replay, local source modification, or old installed PWA support.

The helper fails closed **before any pending intent write** when any protected row belongs to friends/chat or any pending outbox/media exists, or when any one raw row has unknown fields, wrong owner, invalid revision, malformed physical tombstone state, or duplicate opaque ID. It refuses a saved rescue that omits a previously staged pending row; a subset must never impersonate a complete cutover. Only the eight strictly classified private owner domains may be staged and each must roundtrip through v2 authenticated AEAD. Physical RxDB deletion remains a server-visible boolean tombstone without revealing task title, diary content, date or visibility.

The helper does not clear or acknowledge queued records; retries converge to previously staged original operation IDs and ciphertext, including across a browser reload. After all saved rows and existing ciphertext have passed local authentication and semantic preflight, the complete new batch is staged in **one atomic owner-scoped IndexedDB readwrite transaction**. A quota, duplicate or concurrent-record change aborts that transaction without committing any new rows; prior ciphertext is preserved. Local IndexedDB storage is not a durable user-saved backup. On failure the original source and saved encrypted file remain untouched for retry. Global multi-tab source snapshot, historical PWA origins, authentic current root/epoch, v2 signed Function authorization, server CAS/write fence and all social/media migration remain blockers. No Preview/dev/main/Production mutation or E2EE launch is authorized.

The entry point rejects a tampered saved file, wrong root or owner before staging any local plans; browser coverage checks authenticated saved-file retry, *genuinely authenticated* saved files containing unported photos/queued social actions, and the same original ciphertext after reload. The saved file is read and verified in memory; an independent current root/epoch, cross-tab snapshot and remote fencing remain mandatory and are not proven by authentication of a historical saved file.

A partially resumed owner migration also performs a **read-only semantic reauthentication** of every preexisting saved ciphertext intent against the newly verified rescue source *before* inserting any newly discovered rows. A changed already-staged task with a new task earlier in the file must fail without persisting the new task. This guards a single saved-file retry, not concurrent live RxDB writers or multiple racing tabs; there is still no account-wide atomic cutover.

The atomic local batch independently reauthenticates existing row ciphertext and HMAC tags, checks the *exact full previous stored bytes* inside its write transaction, and reauthenticates all resulting plans. It does not make writes in other open tabs or older PWA origins atomic, and cannot establish a trustworthy server root-generation CAS. The browser regression injects a second-add IndexedDB error and concurrent distinct rescues to check all-or-nothing persistence.

## Dormant combined saved-file row + photo staging (no cross-store atomicity)

An explicit alternative in `ownerCurrentOriginRescueBridge.ts`,
`stageSelectedScratchOwnerRescueFileWithMedia`, accepts a **user-selected,
fully authenticated original saved File** with at least one private owner row
and one encrypted photo, and *zero* pending legacy social/chat actions.
Before writes it requires a trusted external owner/MFA/current-root gate,
verifies the complete bundle and rejects a nonempty pending capsule.
The original photo ciphertext/IDs are then staged first using the dedicated
first-write-wins photo queue. The owner v2 row plans are staged only after
the separate authenticated original photo readback confirms exact saved
metadata, manifest and encrypted bytes, and the media comparison repeats
after the row transaction. The older row-only entry point still rejects
Files containing photos. Foreign project/root, changed saved ciphertext,
malformed File, or incomplete photos reject.

**Critical limitation:** The encrypted photo and owner-record queues use
**separate IndexedDB databases**. Each stage is atomic internally, but a
crash, quota error or revoked session between stages can persist photos while
rows remain absent (or cause a post-write rejection). This is *recoverable*
with the **same saved File** and idempotent first-write-wins retry; it is NOT
whole-account atomic staging, evidence of an active backend, an ACK, owner
migration completion or permission to evict source data. Synthetic browser
tests must verify a row-stage failure leaves media and saved bytes intact,
retry convergence, wrong owner/root denial and pending-action refusal.
The actual older installed-PWA origin and external backup remain separate
requirements. No Appwrite Storage, Function, backend fence, normal Preview,
dev/main or Production effect.

## Read-only post-reload local parity audit (not cutover)

`auditSavedScratchOwnerLocalIntentParity` requires the original deliberately
reselected authenticated saved File, the unlocked owner root, current expected
key/generation and an independently trusted owner/MFA/current-root gate. It
**does not stage, write, acknowledge, clear or upload**. It rejects unsupported
legacy queued social actions, omitted/extra private rows, wrong source data,
root or generation, unmatched v2 local ciphertext intent, absent/changed
encrypted photo ciphertext, and interrupted mixed local recovery. It
reauthenticates both IndexedDB stores and matches owner-row semantics to the
saved source independently of randomized nonce/operation IDs; original
persisted operation IDs remain unchanged. The result explicitly says
`verified-local-parity-only-no-cutover`, never remote-ready. Browser coverage
includes rejection immediately after media-only partial staging, parity
after recovery and saved File reselection following reload. This is one local
snapshot/check sequence, **not** cross-store atomicity, historical PWA backup,
genuine server root epoch verification or permission to delete local data.
