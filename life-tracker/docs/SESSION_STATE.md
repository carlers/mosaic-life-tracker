# Session checkpoint

Updated: 2026-10-12
Current task: #708 chat delivery and two-account divergence. No dev/main or Production promotion.

## Verified foundation
- Stable Preview `fix/chat-reliability-708-20261012`, v0.24.0 `c2f7b00`: canonical Quality Gate 38245940586 SUCCESS, Vercel exact-SHA READY (7/7 size budgets), Scratch backend pinned to project `6a96e82d000d1310b3be`.
- On authorized Scratch, exact 11-file `message-action` archive from `c2f7b00` built inactive as deployment `6accd2fa220cb704e674`, subsequently confirmed **active/ready**. Earlier `6accb9addc5321121ebb` retained for rollback. Invalid format handler probe returned 400. No Production backend writes.
- Delivery: sender+recipient row completion required for Function success, client validates ack and retries transient pending sends; draft persistence/duplicate taps guarded; Sync Now preserves orphaned outgoing messages rather than deleting the last copy.

## v0.24.1 repair Preview
- Current task branch `chatgpt/708-compact-repair-20261012`. First candidate `fix/chat-reliability-708-20261012@21f6d67` (PR #735) had focused green but full canonical lint failure (React ref assigned during render) and Vercel total-assets size failure: +1,921 B raw, +805 B gzip, +1,872 B precache. All four startup/entry/Home closure limits PASS.
- Current repair fixes the ref lint violation; consolidates the new manual chat reconciliation to a **single bounded backend action** `repair_thread_all` that verifies mutual friendship and scans two owner snapshots in up to 30 pages of 50 rows. It creates only missing consistent non-unsent/non-deleted counterparts, re-verifies the source, and rejects conflicts; no background history rescan.
- Chat Sync refuses success while local pending deliveries remain; awaits authenticated backend repair + global `syncNow` freshness; reports failure instead of false success. Unit/handler coverage includes recipient/sender recovery, cross-owner data, revoked friendship, pagination, unsend/delete, race, timeouts, pending and account change.
- **Budget review**: `config/build-size-budget.json` carries an explicit #708 review with measured failing Vercel evidence and unchanged four startup/entry/Home ceilings. Three aggregate limits are conservatively adjusted for genuine on-demand feature growth; historic baseline preserved. This follows `docs/AI_WORKFLOW.md` and build-budget review tests instead of byte-golfing safeguards.
- Stable v0.24.1 Preview has NOT passed canonical/Vercel. Scratch active Function is still v0.24.0; do not run v0.24.1 client against old Function and claim reconciliation. Version stamps already at 0.24.1.

## Remaining acceptance
Run task focused CI -> squash PR into stable Preview -> canonical full gate + Vercel READY exact SHA with reviewed budgets. Compare active Scratch Function helper blob SHAs, build inactive exact new Function package, verify READY and activate only after frontend CI/Preview succeeds. Recheck active deployment/origins, run live synthetic two-user/browser/phone delivery and divergence scenarios where tooling permits. Manual mobile/device acceptance remains user-required, with limits clearly stated. Keep #682 dependent notification work deferred.

Next action: focused verification of current compact review batch; repair failures; then stable Preview CI/deployment and coordinated Scratch Function rollout. Do not merge dev/main without user approval.
