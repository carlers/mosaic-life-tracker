# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #889 — preserve authenticated DR null-row fidelity in the current pre-1.0 release candidate. Production changes remain separately gated.

## Verified starting state
- Protected `dev@dff508fb30c7db069fc753cd09359627242a3ffb` v0.29.1 includes #914 Phase A historical-client CI; latest postmerge Quality Gate #38856659851 SUCCESS and exact Vercel dev Preview READY. `main@bb58300052dc4c85974d97779e2b257ec4f28c7d` remains v0.17.4. PR #909 is OPEN and unapproved.
- #889 restored Production R2 snapshot `20261015T110126518Z` to separately isolated DR, with strict verified equality of 6 users, 2924 rows and 137 files. Owner accepted matching v0.17.4 browser flow, then DR-only migrations 010–015 and v0.29.1 Function with upgraded browser 8/8 sync. The upgraded rehearsal target is deliberately no longer snapshot-identical.
- Appwrite's null-to-integer-default coercion was reproduced and repaired in the isolated DR. Source fix on stable `fix/889-dr-null-default-fidelity-20261015@6147e0b4db38a083439ff8f6520785fe782d735a` passed full canonical #38784784588 but had not entered dev.

## This isolated task
- Reapply the three previously full-green source/test/runbook files **byte-for-byte** onto the latest protected dev tree: `scripts/dr-restore.mjs`, `tests/unit/drRestore.test.ts`, `docs/DISASTER_RECOVERY.md`. Keep exact-backup equality and restoration of optional integer defaults on row errors; do not weaken verification.
- Refresh release-readiness documentation in the same task. No user-visible version bump, UI, schema, Function, Production, Scratch or DR target changes.
- Commit to `chatgpt/889-dr-recovery-dev-20261016` with `[verify:focused]`, then stage a fresh CI-first stable `fix/*` Preview with full canonical acceptance. Promotion into protected dev is a separate owner gate.

## Remaining #889 gates
1. Owner verifies all known v0.17.4 Production clients have no pending offline writes and are synced, closed/upgraded or retired before 012/013/015; no external clients known. If not possible, a proven compatibility bridge is required.
2. Explicitly approve and verify **Production** Appwrite migrations **010–015 one at a time**, preserving independent authenticated recovery and excluding 008/unscoped migration runs.
3. Separately authorize Production `message-action` inactive build and activation, preserving its old READY deployment, hourly schedule, permissions and secret settings.
4. Signed-in Production two-account, Sync Now, offline/mobile/PWA, Diary/chat/social/notifications/photos privacy acceptance; separately authorize PR #909 dev→main and pre-1.0 release. Do not tag 1.0.0.

## Next action
Finish focused CI on the current task, inspect exact diff/source provenance, squash only onto isolated stable after focused PASS, verify full gate and Preview READY. Keep protected dev/main and live Production unchanged until explicit owner approval.
