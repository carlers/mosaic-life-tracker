# Session checkpoint

Updated: 2026-10-14
Current task: #592 CI-first Preview cutover — explicit canary disable staged, NOT merged.

## Verified
- Protected main `0c0152807c450071f5adfabca67d9344ccf0aa77` v0.17.4, Quality Gate #38513209910 SUCCESS, Production READY, main ruleset zero bypass actors. Trusted read-only receiver #38514394131 SUCCESS, protected prebuilt writer job still OFF.
- Protected dev `f3d9558f` v0.23.4 unchanged.
- Canary stable `fix/592-trusted-archive-20261014@9671c6fef4c39b4b83561ade783f9ac27b7f366a` fully green (Quality Gate #38514244989), Git Preview READY, shadow PASS; original `fix/*:true` restored.
- A two-push experiment excluded the canary from an extglob but left no matching false rule; Vercel produced two Git Previews, one on red CI. Standard slash-sensitive minimatch confirms `*: false` fails to match branch names containing `/`; unmatched branches default to enabled. Root cause likely identified, not yet live revalidated.

## Scoped candidate
- Main-based policy `fix/592-main-explicit-canary-off-20261014` requires explicit `fix/592-trusted-archive-20261014:false` and non-overlapping other-fix allow; full Quality Gate #38518065096 SUCCESS and exact Vercel Preview READY. Protected-main PR #816 requires NEW owner-approved PR-only merge exception. Nothing in main is changed by that PR yet.
- This task stages the corresponding canary `vercel.json` change, matching trusted high-level config fingerprint allowlist and regression tests. This task branch is quiet; stable canary must NOT be updated until protected-main #816 is merged, verified, and rollout reviewed.
- Writer creation/alias switches stay OFF. Do NOT assume first changed canary push will suppress Git (Git may evaluate old config); require at least one later ordinary push with suppression already active to prove zero Git deployments, without fabricated red CI evidence.

## Next action
- Verify focused task CI, leave PR to canary in DRAFT, do not merge to stable.
- After new protected-main PR #816 owner approval and full main CI/Production checks, perform bounded canary rollout. Confirm zero Git previews on subsequent push first, then one accepted prebuilt Preview from trusted main, exact SHA/Scratch/routes/headers, no retry duplicates, rollback available. #592 OPEN until real feature workflow proves CI-first.
