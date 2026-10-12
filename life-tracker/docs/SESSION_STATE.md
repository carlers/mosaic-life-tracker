# Session checkpoint

Updated: 2026-10-12
Current task: #708 chat reliability v0.24.1; user accepted tested Preview, authorized dev merge. Main and Production are not approved.

## Accepted chat fix
- Stable chat Preview `fix/chat-reliability-708-20261012@473fdd50485db63db4d89806b1ae81b5e7f59e6f` (v0.24.1), PRs #735/#742. Canonical Quality Gate `38254189770` SUCCESS, Vercel `dpl_DbWahM5WCRgM3YTJGt2Mop5G9dYi` READY, stable alias `mosaic-life-tracker-git-fix-chat-9dae4d-carls-projects-72516fde.vercel.app`.
- Delivery commit/ack is fail-closed if sender/recipient server rows are not committed; pending transient sends retry; composer draft preserved on local failure; duplicate tap guarded; global Sync Now preserves local outgoing message if server copy missing.
- Manual chat Sync uses one bounded, authorized Scratch `repair_thread_all` Function request to scan two owner snapshots; validates identity, friendship, conflict/unsend/deletion, source state and 409 idempotence. Then awaits the global sync freshness barrier, reporting incomplete on failure. Handler, unit, DOM and browser contracts green.
- Live Scratch project `6a96e82d000d1310b3be`, `message-action` Function `6aa8057f002a4c306fdd`, compatible Diary-preserving commit `8c5afc787dca7a4c8d214f0b24a0e82991fd5f71`, deployment `6accddcbede4ccb26900` active/ready in last verified read, with earlier `6accda8b417b8d3be755` retained for rollback. Focused Scratch integration CI `38254354983` SUCCESS; nonfriend smoke rejected 403. Never replace concurrent Diary Function with older chat-only Git code.
- User confirmed the Preview works on 2026-10-12. This is user acceptance, not independent device-performance instrumentation or comprehensive matrix certification. Issue #708 records the release history and known limits.

## Dev integration
- Approved `dev@d9d2cc1f3650889c30c43478d90e6519524c851e` (v0.23.4) has newer #692 calendar interactions and #656 warmups. Direct #708 stable→dev PR #744 is **conflicting**, so build a new integrated Preview from exact dev tree, carry forward all 17 #708-specific paths, preserve every dev-only path and its reviewed #692/#656 size ceilings. Candidate v0.24.1 is greater than dev v0.23.4.
- Combined budget keeps current dev limits and adds #708's measured earlier Preview review to `priorReviews` for audit history. The #692 dev limits already exceed all three of #708's reviewed aggregate limits; no new increase is assumed. Canonical and hosted build must independently pass the resulting combined tree.
- Preserve chat and calendar UI behavior, no unrelated refactors. Use focused task branch→integrated `fix/*` Preview→canonical CI+Vercel READY→accepted Preview PR into dev. Verify actual PR tree and new dev CI and deployed dev Vercel; never merge `main` or touch Production.
- Further hardening (fine-grained permanent-denial UI, historical one-copy absence without a safe source, latency measurements) remains tracked as limitations/follow-up; do not claim measured before/after latency.

Next action: verify exact integrated Preview tree, canonical GitHub CI and hosted Vercel budgets; repair measured failures, then merge the integration branch into dev on user approval already granted and record #708 status.
