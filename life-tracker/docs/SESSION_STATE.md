# Session checkpoint

Updated: 2026-10-11
Current task: double-check and harden Scratch parallel-backend integration #526.
Baseline: stable integration branch `refactor/scratch-backend-integration-526` at `0b0c1b35b532fec776f193f60c113cbf7d817cb7` before audit repair. This source contains #406's shared tasks and #407's Backlog privacy guards, **not** an approved dev/main promotion.

## Verified before audit

- Initial integration task PRs #529 and #533 squash-merged to stable Preview; full canonical run 38074726460 SUCCESS and exact Vercel READY.
- Live Scratch `message-action` remains at older deployment `6aca71f3ec33c9501753`, not integrated source. No Scratch Function mutation or production changes from #526.
- The activation workflow is only on Preview, not default branch; it needs manual GitHub environment configuration, preflight security and cross-feature hosted acceptance before operational usage.

## Audit repair

- Harden workflow so the selected SHA must equal the current reviewed integration head and a full successful exact-SHA stable CI run. Never execute an arbitrary supplied checkout with a Scratch API key.
- Scope secret exposure only to backend read/build/activation steps; no persisted GitHub Checkout credentials, and document a required protected GitHub environment with human review.
- Preserve scope limits: this is a Function deployment workflow; schema migrations and out-of-band Appwrite mutations still require coordination and cannot be claimed automatically serialized.

## Next action

Run focused CI for the audit task, squash-merge into the stable integration Preview, rerun full canonical CI/Vercel and record exact accepted SHA. Do not change live Scratch or promote to dev/main without a separate approved rollout. Issue #526 remains open pending credential/configuration enforcement, authenticated compatibility tests and backend activation.
