# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #889 combined pre-1.0 regression candidate; source-only integration of accepted #855/#745, pinned #914 release-client policy and Scratch runbooks. Isolated task branch `chatgpt/889-integrated-pre1-20261016` (base `fix/745-send-denial-20261016@62a5d63470e46b5f44941953bfaf211aa724ccd0`), proposed combined Preview v0.29.4.

## Verified baseline
- Protected `dev@f9e01b6fc8f8913b75a9738fc978c0ed55427d98` = v0.29.1; Production `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` = published v0.29.1. No 1.0 approval.
- Owner accepted #855 far-date Day View on `fix/855-day-view-window-20261016@10feb70b8d942593fbbd11b2ed5d6120cab35500`, full canonical #38915794320 SUCCESS; and #745 Not sent/Retry on `fix/745-send-denial-20261016@62a5d63470e46b5f44941953bfaf211aa724ccd0`, full canonical #38922596566 SUCCESS. #745 also owner tested offline/retry and account isolation. Hide-on-unfriend stays current behavior; enhancement deferred #937 post-1.0.
- #914 source-only policy and live test runbook from `security/914-release-client-compat-20261016@eec2d3bfabb945ee91790a06213827b5028aac1a`: supported client pinned to published main v0.29.1, legacy v0.17.4 owner-retired. Scratch wildcard guidance from `security/914-scratch-wildcard-20261016@5e4ed022840f785face593db3112fd35936910f2`: `*.vercel.app` intentionally covers single-label Preview domains; Production stays narrow.
- #914 owner reports SUCCESS for v0.29.1→v0.29.3 same-origin live PWA upgrade (offline edits to task/Diary, deletion, old app reconnect before updating, independent fresh session convergence, normal update/reload, data persisted, final Sync Now green). Isolated compatibility alias switched only from v0.29.1 to v0.29.3; no backend changes. Live backend schema/Function expansion, negative cross-account privacy tests and rollback remain NOT RUN / UNASSESSED. See issue #914 comment 6226143261.
- Scratch project `6a96e82d000d1310b3be` active with READY `message-action@6ad04931c34b463de0b4`; no Scratch or Production schema/Function mutations in this integration. No secrets copied.

## Integration scope and version decision
- Base is accepted v0.29.3 #745 code. Cherry-pick exact file contents only for #855 Day View hook/sheet and React regression, retaining all #745 denied-send source/regressions.
- Apply docs and pinned supported-release policy from #914 branches without touching sync/schema/Function behavior.
- Version **v0.29.4** because this combined user-testable Preview tree differs from both separately published v0.29.2 and v0.29.3 Preview artifacts; align package manifest, lock root, and appVersion.
- Update #914 Phase B runbook with *owner-reported frontend-only* PWA acceptance, not full backend compatibility PASS.
- No new features, hide-on-unfriend UX changes, backend mutations, Production changes, protected promotion or 1.0 release.

## Next action
- Run focused CI on this task SHA; fix failures. Then squash via explicit task→isolated stable `fix/889-pre1-integration-20261016` PR, run full canonical CI and trusted Vercel READY Preview; verify combined app versions, both fixes, Scratch backend and regression coverage.
- Ask owner for combined Preview smoke/acceptance before separately proposing a protected dev promotion; it is **not authorized** by this task.
- Keep #936 comprehensive security/privacy audit as mandatory pre-1.0 gate; #914 changed-backend rehearsal and privacy/rollback negative tests remain uncompleted. Never tag v1.0.0 absent owner signoff.
