# #1662 Stage 1 source-only execution checkpoint — 2026-11-19

**Owner authorization:** implement M0–M3 through testable isolated Preview and verified disposable Scratch, without dev/main/Production promotions. Adopt the latest blueprint on draft PR #2077. Exact dev base: c984ff30ee004d7ee7a68b3807de42e4cc4c3829.

**Current tranche:** source-only M0/M1 groundwork. Generic WebCrypto AEAD and independent recovery/device envelope code selectively adapted from synthetic #2037 pilot, domain allowlist and TS compile-time exhaustive field classification, focused security regression tests. No user-facing activation, normal sync cutover, backend mutation or new E2EE claim; normal data remains plaintext.

**Blocked external preparation:** shared Oracle Scratch list-tables/verify-resources tools return blocked. Function metadata-only diagnostic is not E2EE schema parity. The separate Oracle TEST Admin targets project 6ae1bf2e00034572451b and MUST NOT be substituted for shared Scratch 6ae94a2100014d01f5ed. Vercel Sandbox V2/V3/V4 creation returned 400 bad_request, so shell-based full npm tests not yet accessible. Pursue GitHub focused CI/other sanctioned tools; no credentials or dashboard mutations.

**Next milestones:** review actual current schema and all mutation sinks; atomic root enrollment and recovery envelope backend contract; Git-owned additive ciphertext tables and lossless CAS migration; Scratch-specific permissions/readback; full encrypted owner and social/chat adapters; installed-client old-writer fence, protocol review, complete test suite and one stable Preview. Stop feature activation if backend/crypto gates remain blocked.

**Security:** No six-digit PIN-based decryption, no plaintext fallback, no user-data migration, no Production work. Browser nonextractable keys are not hardware isolation. Legacy IndexedDB plaintext, direct storage writes, and operator ability to change hosted JS remain limitations. #2083/#2084/#2085 track milestones and #2086 trusted-device stage follows core acceptance.
