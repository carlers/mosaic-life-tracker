# Session checkpoint

Updated: 2026-10-13
Active: #592 protected Preview canary proven; harden idempotency readback.
Issue #592 and live GitHub/Vercel readback are authoritative.

## Accepted evidence

Stable `fix/workflow-build-parity-592-20261012@c6b4dd304efcdeb616398ce432d10480ff55f3e0`.
GitHub canonical `38289724629` SUCCESS, ordinary Git Preview
`dpl_7TcELUag2fVQqpnRSVuP41buikJB` READY on stable alias.

Owner's manual dispatch `38290165183` attempt 2 fully SUCCESS:
canonical, protected canary, effective Scratch+GIPHY variables,
Node 24, all seven budgets, prebuilt upload. Vercel
`dpl_9CgjZjmxMCqSqZxEkSpVspxKbB3d` READY,
`source=cli`, full matching commit SHA, target Preview. It has
a standalone deployment URL but **no stable branch alias**.
No `dev/main` or Production changes; normal Git auto-deploy
still owns stable Preview URL.

## Active isolated task

`chatgpt/592-canary-dedupe-20261013` from accepted stable SHA.
Vercel list API omitted custom `mosaic_canary_*` meta tags for
the CLI canary, instead exposing exact `githubCommitSha`, official
owner/repo, and `githubCommitRef=HEAD` (vs normal Git branch).
Repair fail-closed idempotency to recognize this exact-SHA CLI
READY candidate without mistaking hosted Git deployment for canary.
Add real-shape unit tests, update parity diagnostics. No Vercel
deployment changes.

## Next action

Focused task CI, squash to existing stable Preview, full canonical
and Vercel Git Preview verification, issue checkpoint. Then harden
automatic exact-SHA CI-green Preview deploy with stable alias and
one-time trusted environment setup; **zero routine owner GitHub
dispatches or approvals**. Do not disable existing auto Git Previews
until acceptance proves replacement and non-duplication. Same SHA
prebuilt local JS/CSS fingerprint `e24cedd...` differs from
hosted Git `13df5b4...`; controlled parity investigation
outstanding. #592 open for budget policy, audits, promotion pilot.
