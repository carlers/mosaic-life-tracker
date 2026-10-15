# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #592 integrate accepted #853, #852, #851 into dev behind the default CI-first deployment gates.

## Accepted source baseline
- Protected dev was `5f8acd6be8006480a97fad9aee266530f10183c2` v0.26.2 after approved policy-only PR #899; dev gate #38714068003 SUCCESS and READY. Generic `feature|fix|perf|security|refactor/*:false` stable Git suppression inherited by new branches; dev/main remain Git-deployed. Main still `bb58300052dc4c85974d97779e2b257ec4f28c7d` Production v0.17.4.
- #853 Task/Category editor focus: accepted `feature/edit-focus-853-20261015@d19fadc51eb4688313cd18d60e7714e819dcaee4` v0.27.0 canonical #38692455574 SUCCESS.
- #852 Yesterday/contextual Today: accepted `feature/quick-date-actions-852-20261015@2898147968062abdf0ef4164f818c569743a23e8` v0.28.0 canonical #38703473737 SUCCESS, trusted CI-first Preview READY.
- #851 select category only in Select mode: accepted `feature/category-day-select-851-20261015@5ed2629eae28cc96fb44b2946b9aeaa0dbdeec19` v0.29.1 canonical #38710984351 SUCCESS, trusted CI-first Preview READY. Prior v0.29.0 direct-pill selection outside Select mode was NOT accepted.
- Owner explicit: “852 also approved, merge it all to dev.” This authorizes protected dev integration of these 3 accepted features and #592 source policy, not Production/backend/main release.

## Integration strategy and invariants
- One isolated integration candidate started from CURRENT dev after #899, because all three accepted feature branches originate at earlier dev `6d488d3c`; merging each blindly would cause overlapping task sheets, checkpoint/version regressions, and fail exact-tree promotion.
- Preserve complete exact source for unique user-visible feature files from accepted stable branches. Merge #853 TaskActionSheet exit restoration and #852 local-day Yesterday actions + both regression tests; merge #851 Day View select-mode-only handler with #852 bulk yesterday prop behavior. Keep #851 v0.29.1 final version in all 3 sources; no new version allocation.
- Keep inherited CI-first source policy and all existing dev Diary, notifications, chat and sync. No Appwrite migration/Function/backend change. No unapproved UI redesign.

## Next action
Run task focused CI and fix real failures; squash into new feature-stable Preview seeded from current dev with first-ref Git suppression; require exact stable full canonical SUCCESS and protected immutable CLI READY. Then open/verify protected stable→dev PR, guarded merge preserving accepted exact tree, dev promotion evidence reuse and Vercel READY. Report combined manual/device testing as unverified; individual features accepted by owner. Return to #592 closure and #889 release audit; NO Production/main/1.0 authority.
