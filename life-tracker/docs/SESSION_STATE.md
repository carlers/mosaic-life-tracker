# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #592 — promote inherited generic CI-first source policy to new stable branches through protected dev after owner authorization.

## Verified current state
- `main@bb58300052dc4c85974d97779e2b257ec4f28c7d` v0.17.4: protected main owns general trusted CI-first receiver/writer; ruleset bypass actors removed. `dev@6d488d3c3b2ae0e998162d4fe70303fdfa58b964` v0.26.2: still Git-first on feature/fix/perf/security/refactor; no protected product promotion instructed.
- Source policy `chatgpt/592-default-ci-first-source-20261015@aa10ea6fca15087c58dbbf26a28677bec18550e1`: focused Quality Gate #38698327093 SUCCESS. Reviewed `life-tracker/vercel.json` disables Git on single-leaf stable categories from first commit, preserves main/dev Git and quiet task suppression.
- Real CI-first feature pilots used this same reviewed source: #852 v0.28.0 canonical #38703473737 / trusted #38703741227; #851 v0.29.1 canonical #38710984351 / trusted #38711265392 and owner accepted 2026-10-15, recorded in #851 issue. Both hosted Previews READY; #852 user acceptance not recorded.
- #853 v0.27.0 owner accepted (but Git-first), #852 v0.28.0 unaccepted, #851 v0.29.1 accepted. All three stable product branches remain outside dev pending independent `merge to dev` instructions. Stable versions must be integrated carefully in order; shared TaskActionSheet and DayViewSheet overlap.

## Scope / approval gates
- Final #592 source-policy infrastructure-only task: no app behavior/version changes, no Appwrite schema/Function or Production writes.
- Run focused task verification then squash to `refactor/592-default-ci-first-source-20261015`, source-first at reviewed Git-suppressed commit; exact full canonical then one trusted CLI Preview READY. Verify supported glob rules, active trusted main, Scratch host and rollback instructions.
- Owner must separately authorize stable→dev promotion; do not merge merely because issue or Preview is accepted. Keep #592 OPEN until inherited dev policy and promotion gate verified; after that continue #889 release-readiness from its latest checkpoint.

## Next action
Verify focused task and branch protection; squash through stable PR; verify exact full canonical and Vercel READY. Record acceptance/provenance and obtain explicit owner instruction for dev merge. Do not promote unrelated product features or close #592 early.
