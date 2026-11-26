# Device approval: dormant human-fingerprint request preflight (Phase D)

Tracking #1662 / #2086. The isolated-Scratch-only `deviceApprovalPreflight.ts` supplies **request creation, strict public-key/metadata validation and an independent human authentication fingerprint**. It cannot enroll a device, send/approve the account root, access Appwrite, read a credential, or transmit anything. It is intentionally separate from the unselected reviewed HPKE RFC 9180 implementation and from the source-only Phase C chat identity work.

The new-device request contains an ephemeral P-256 ECDH public key (browser-generated with a **nonextractable, memory-only private CryptoKey**), a random 128-bit request ID, independent 128-bit nonce, owner and device IDs, a purported owner root key ID and generation, and a maximum five-minute lifetime. The new device must already have completed account MFA through an **independently trusted** `FullyAuthenticatedSessionGate`; neither a server-supplied Boolean nor a cached login is a substitute.

The trusted approver validates that owner/project, new-vs-existing device, key ID and current root generation match its **independently authenticated current root session**, verifies exact request fields, rejects unknown plaintext payload fields, malformed/off-curve keys, stale/clock-skewed requests, and compares a **96-bit fingerprint of the complete request transcript** through a physically independent human check. This is an authentication comparison, **not a six-digit recovery PIN**, a server receipt, or an encrypt/decrypt command. The API returns only `fingerprint-matched-not-approved`, never an approval capability.

**Critical unfinished dependencies:** the request fingerprint alone does not prove the server is honest or that the independent comparison happened. The server must implement an owner+MFA-authorized, short-lived, single-use relay and independently signed/serialized approval state; persisted anti-replay and denial, two-tab arbitration and expiration must be proved **before** any root encryption. A separately reviewed maintained HPKE library must bind the full verified transcript as info/AAD, encrypt the account root only to the new-device ephemeral key, authenticate the response, and let the new device use an independent local root wrapper. The emergency recovery key remains the fallback. Root generation/revocation, account deletion, WebKit/iOS/Android PWA behavior and full two-device synthetic Scratch acceptance remain unverified.

There is no live enrollment, new server schema, Function route, device authorization, Appwrite traffic, normal Preview, `dev`, `main`, Production or version bump. This is deliberately unusable to transfer keys until the reviewed Phase B/C and backend security gates are complete.

## Async transcript input snapshot (2026-11-26)

The publicly callable request fingerprint function takes an independent
structured copy of the candidate approval request before awaiting WebCrypto
P-256 import/validation. A concurrent caller mutation cannot change the
fingerprint's owner, request nonce, key ID, device, generation or timestamp
between point validation and transcript hashing. This remains only a
local, manually compared preliminary request: no relay, HPKE, root transfer,
signed receipt, session persistence or actual approval is implemented.

## Canonical public request transcript (2026-11-27)

`verifiedDeviceApprovalTranscript` now exposes one rigorously validated,
length-framed, domain-separated byte serialization of the entire synthetic
new-device approval request. The user-facing 96-bit comparison fingerprint
hashes these **same** serialized bytes; a future reviewed HPKE implementation
may bind the full transcript as part of authenticated `info` and/or AAD rather
than accidentally omitting the owner, device, nonce, root epoch, key or expiry.
The function copies the request before awaiting P-256 validation; tests prove
determinism independent of JavaScript property order and changes to every
allowed request field. The transcript itself is public context, **not** a
signature, proof of MFA, relay authorization, approval receipt or root transfer.
Approver-device identity, source authentication, anti-replay and expiry/revocation
must still be separately bound and verified by the selected audited protocol.
No new cryptographic library, Appwrite call or released code path was added.
