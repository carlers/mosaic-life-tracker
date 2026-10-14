# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 second CI-first feature Preview pilot, isolated branch opt-out.

## Verified
- Owner merged protected main PR #837 as `2a6210d940c0387e88a617684ba4e24a21b7e1ad`; full main Quality Gate #38558325570 SUCCESS, exact Production Vercel `dpl_5gja3K4uWzYC8pquT2tfVQzgoDqU` READY at app v0.17.4. Ruleset #24880070 ACTIVE with zero bypass actors; `dev@f3d9558feca499e53c310c5a37be2794717bccf6` unchanged.
- Original isolated fix canary proved exactly one CI-first static Preview READY and subsequent same-SHA NO-POST reuse. Main-owned approved gate now allows just this fix canary and `feature/592-prebuilt-pilot-20261014`; no wildcard branches.
- Current dev `vercel.json` matches reviewed main fixture byte-for-byte before pilot suppression.

## Current scoped implementation
- For this exact pilot feature branch, replace only `feature/*: true` with non-overlapping `feature/!(592-prebuilt-pilot-20261014): true` and exact `feature/592-prebuilt-pilot-20261014: false`. Preserve all other Git-auto categories, routes, headers, `main`, `dev`, Scratch profile, app and version.
- The stable feature ref MUST NOT exist before its first dev-derived commit already contains this policy. Task work runs on quiet `chatgpt/**`, then first stable branch commit must be created in Git storage and ref created pointing to it (never create the stable branch from unmodified dev).

## Pilot red gate and narrowly scoped repair
- Initial pilot stable `585617863900ddaf99cad7754a12b517d9168af3` had zero Git-hosted deployments while full CI #38559022874 failed its NotificationsPage DOM shard: October 7 alerts aged beyond default seven-day retention. This is pre-existing on dev; the same root cause was corrected on main in PR #836 and fully validated in main CI #38558325570.
- Port EXACT tested `NotificationsPage.test.tsx` suite-local `Date.now` spy and `afterEach` restoration from verified main; no runtime feature code, version or Git delivery policy changes. CI-failing source must NOT trigger trusted Preview writer.

## Next action
- Focused task verification, then create one initial stable `feature/592-prebuilt-pilot-20261014` commit with the same reviewed policy atop exact dev and run full canonical CI. Confirm no provider Git Preview for any pilot SHA; default-main trusted receiver/writer must deploy exactly one static CLI Preview only on accepted canonical success, with no aliases. Verify same-SHA reuse with zero POST, hosted routes/headers and rollout/rollback. Do not promote this infrastructure pilot to dev/main without separate approval.
- Keep #592 OPEN. Manual registered Scratch login/device acceptance remains unverified.
