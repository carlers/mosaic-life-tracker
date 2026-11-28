# M3/M4 browser crypto dependency security-selection gate

Tracking Mosaic #2085 / #2086. **No external HPKE, MLS or Signal library is approved or installed as of 2026-11-27.** This source-only policy is not an E2EE cryptographic implementation or activation.

## Verified security findings

- **Critical AEAD nonce reuse:** `@hpke/core` versions up through **1.7.4** were affected by a concurrent asynchronous `SenderContext.seal()` race; maintainer advisory **GHSA-73g8-5h73-26h4 / CVE-2025-64767**, patched at **1.7.5**. Reusing nonces can compromise confidentiality and integrity. See [maintainer advisory](https://github.com/dajiaji/hpke-js/security/advisories/GHSA-73g8-5h73-26h4), [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-64767), and [fix](https://github.com/dajiaji/hpke-js/commit/94a767c9b9f37ce48d5cd86f7017d8cacd294aaf). A patched release does not independently prove that any future exact version is fully audited or integrated safely.
- `@hpke/core` is a WebCrypto-based RFC 9180 candidate with DHKEM P-256. Verify current npm registry exact version, provenance, tarball integrity and transitive dependency lock **at selection time**; third-party indexes can be stale.
- [OpenMLS](https://github.com/openmls/openmls) implements RFC 9420 MLS, with a WebAssembly target that requires browser randomness/time. A [May 27, 2026 external audit report](https://blog.phnx.im/openmls-independent-security-audit/) describes eight findings, including one High, with seven fixed at that time. Subsequent releases/advisories and WASM integration require fresh version-specific review. Browser support claimed by a Rust project does not prove Mosaic PWA state safety.
- Mosaic already has a dormant new-device P-256 request and `verifiedDeviceApprovalTranscript`. Neither is an approved HPKE root-transfer protocol. Recipient pins are not Signal/MLS conversation security.

## Enforced lockfile gate

`tests/unit/e2eeCryptoLibrarySupplyChain.test.ts` reads the real app `package-lock.json` and refuses known vulnerable `@hpke/core <=1.7.4`. It also fails whenever one of the identified candidate libraries appears without a **separately security-reviewed exact version** in the approved mapping. The mapping is intentionally empty. Expanding the mapping requires an independent review, pinned artifact and documented threat model. The test does not replace full SCA across all npm packages.

## Required source-only proof before selecting a library

1. Review exact upstream release commit, security policies, dependency provenance, current advisories, transitive lock and published package integrity. Review browser/WebAssembly/PWA device support.
2. Verify RFC 9180 test vectors, on-curve P-256 validation, AEAD ciphertext/AAD tamper rejection, concurrent `seal()` nonce uniqueness and failure behavior using disposable synthetic 32-byte keys in Chromium/Brave, Android and iOS WebKit PWA contexts.
3. Bind **the complete canonical approved request transcript** plus independently verified approver identity, account key generation and signed single-use relay state into a reviewed HPKE `info` and AAD protocol. The 96-bit comparison fingerprint is not an encryption key or relay permission.
4. Require an MFA-authenticated, signed, root-generation-serialized, one-shot relay state with replay/journal checks **before** any actual root key is transferred; reject stale/foreign devices and expired or changed requests.
5. For chat and group sharing, select a complete independently reviewed messaging protocol including recipient identity, forward secrecy, membership revocation, two-tab rekey/ordering, durable keys and recovery. MLS does not supply Mosaic’s trusted directory, delivery service, local state or privacy-preserving logs.
6. Run synthetic wrong-owner/epoch/nonce and real old installed PWA interoperability, cancellation, reinstall, offline recovery, erasure/DR checks; only after exact private Oracle CI, installed backend serializable root epoch, signed Function and old plaintext writer-floor gates pass.

**Status: no vendor chosen; no new dependency, production service, server code, normal Preview, dev/main or Production modification.** No library-selection paper is evidence of an enabled end-to-end encrypted product.
