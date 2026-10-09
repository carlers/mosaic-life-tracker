# Session checkpoint

Updated: 2026-10-09
Current task: #434 — second default-first safety batch (friend calendar and backend mapping)
Branch: `chatgpt/default-first-ownership-contracts` from dev `e5e5ca65515c8e54712e2d35613e59b16f547fb5`
Target stable Preview: `refactor/default-first-ownership-contracts`

## Objective and constraints

- Ensure a retained friend-calendar hook never reveals another viewer's previously loaded tasks, accepts old-owner or superseded fetch results, or rolls back another viewer's optimistic reactions.
- Add a cheap, six-collection contract proving synced Appwrite serializer fields exist in the Git-owned backend manifest and declared remote columns do not trigger false unknown-field warnings. Preserve outgoing-message server-owned `read_at` omission.
- Preserve current sync/account lifecycle, owner-keyed friend cache, backend and Function schemas, app styling, gestures, and CI/deployment architecture. No Appwrite cloud/production mutations.
- Version impact **NONE**: scoped account-privacy/async guardrails and contract tests, not a separately user-testable product feature. Reassess if scope expands to visible feature behavior.

## Evidence

- Live starting `dev` `e5e5ca65` (v0.6.1); `main` `0159222c` unchanged; source verified before branch creation. Existing account generation, sync owner and delivery/outbox guards remain intact.
- Test-first task commit `56d2eb0c` [verify:focused]: run `37904900971` demonstrated three **behavioral-red** friend-calendar failures: old viewer data on owner switch, stale reaction rollback, out-of-order same-owner refresh. One extra test assertion incorrectly passed an empty message (missing required `direction`) and was fixed in test fixture, not production serializer.
- Implementation is hook-local (viewer+friend keyed presentation and request generations), plus six-collection serializer/manifest regressions; no sync/network/backend workflow changes.

## Verification and delivery boundary

Next action: verify coherent task SHA with focused CI, fix any failures; squash into stable Preview and require full canonical acceptance + exact-SHA Vercel READY. Update #434 with results and request separate user approval before stable Preview -> dev. Do not touch main. No device/manual or live Appwrite schema check is claimed for this frontend-only scope.
