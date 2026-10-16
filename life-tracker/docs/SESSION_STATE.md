# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #592 trusted generic CI-first Preview producer pin after #914; supports #889 DR recovery integration.

## Verified evidence
- Protected `main@bb58300052dc4c85974d97779e2b257ec4f28c7d` remains v0.17.4 with trusted generic receiver. Protected `dev@dff508fb30c7db069fc753cd09359627242a3ffb` is v0.29.1 with #914 historical-client Quality Gate.
- #889 restored the R2 snapshot to isolated DR, strict verified 6 users / 2924 rows / 137 files, tested ordered 010–015 schema+Function upgrade on DR and received owner browser acceptance. No real Production backend upgrade or client-retirement approval.
- DR fidelity source fix replay: focused task #38865174720 SUCCESS; isolated stable `fix/889-dr-recovery-dev-20261016@69dff37905e42be3bc3423790afede62a9726aee` canonical #38865387907 SUCCESS. Protected dev/main remain unchanged; stable cannot be advertised as CI-first READY until trusted receiver passes.
- Main-owned Trusted Preview Delivery #38865616797 **FAIL CLOSED** with `Unreviewed generic Quality Gate definition`. Precise root: pinned reviewed old blob `5f64f715551f0c311a60d823367d849dfb369bba`; #914 adds only a new historical-client preflight step, producing exact blob `28781399a01981c3e96aa99f8925320b0f61b8e4`.

## This isolated fix
- From protected main, allow **only** both security-reviewed Quality Gate Git blob SHAs for generic trusted admission. Preserve all other branch/owner/CI SHA/artifact/provider checks; test rejection of unexpected third hash.
- Document the exact evidence. Version impact NONE, no application UI/runtime/backend/schema changes and no protected branch, Production, Vercel, or Appwrite write authorized by this task.
- Task `chatgpt/592-914-trust-pin-20261016` → focused CI; stable `security/592-914-trust-pin-20261016` → full canonical/Preview (may use normal main-era Git Preview while main still owns the old pin).

## Next action
After focused/full CI and diff review, prepare main infrastructure-only PR; **obtain separate explicit user permission** before any protected-main mutation (including required protection setting exceptions). Once approved, verify exact main CI/Production-safe delivery and revalidate the #889 stable trusted receiver. #889 still requires old installed PWA retirement, Production migrations/Function approvals and real Production acceptance before PR #909 can merge.
