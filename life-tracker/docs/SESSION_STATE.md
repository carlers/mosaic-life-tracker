# Session checkpoint

Updated: 2026-10-10
Current task: #407 Backlog user-approved implementation; no dev/main promotion approval.
Baseline: dev 224f8a700f35bbe3853206ee208e1dc103ece5b3 (v0.12.1).
Task branch: chatgpt/backlog-foundation-407, candidate Preview v0.15.0.

## Progress and decisions
- Foundation 2ccb42b guards server friend calendar, friend task lookup, reactions and notifications with valid scheduled dates; focused GitHub checks passed.
- Pending client implementation: lazy Backlog sheet from Home menu, date-free quick add/edit/complete/delete and same-task-ID scheduling. Day View's "Move to Backlog" action now updates date; Home search labels and opens Backlog matches.
- Existing task schema can represent date='' locally; Scratch Appwrite required-varchar create returned success but readback immediately found no row. **Durable remote/replication proof is unresolved** and must precede Scratch authenticated acceptance.
- Restore updated for explicit undated dates while rejecting missing or invalid dates; old backup compatibility and friend privacy/DOM tests added.
- Candidate feature version 0.15.0 chosen after dev v0.12.1 and concurrent 0.13.x/0.14.x Preview features. No Git-owned Appwrite schema migration or production changes.
- Scope deliberately excludes TodoMate mapping changes, new goal domain, custom drag ordering and bulk scheduling; #406 shared task coexistence needs recheck before release.

## Next action
Focused CI passed at ccab1fc. First stable Preview full gate at 844b9f1 compiled/PWA passed and both DOM shards passed; review-only aggregate size thresholds needed a measured adjustment (raw 2,326,782B, gzip 716,542B, precache 2,409,793B). Entry, startup and Home ceilings remain unchanged. Re-run canonical full stable Preview after the adjustment. Then complete Scratch deployment/readiness and Scratch Function deployment/readiness. Verify owner sync on disposable account, existing cross-user/alert privacy, old cached PWA, backup restore, account isolation, Light/Dark/Black and physical Android Back separately. Keep Bucket List #405 as separate next-phase feature. No dev/main promotion until user approval.
