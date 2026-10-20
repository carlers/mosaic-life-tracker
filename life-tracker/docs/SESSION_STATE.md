# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 Supabase expired-session recovery and isolated Preview, candidate v0.32.1.

## Accepted baseline and scope
- Accepted `refactor/1027-supabase-hosted-20261020@1bb2521cdde8c94d7880c4f893aecdcbae5a5cd9`, PR #1096. Canonical #39434937928, real local lab #39434939925 and trusted Preview #39435264359 passed. Full resume evidence: #1027 comment 6292548078.
- Task `codex/1027-supabase-recovery-20261020` → intended stable `feature/1027-supabase-recovery-20261020`. PATCH from Supabase candidate 0.32.0 to 0.32.1. Main is 0.29.1; unrelated dev is 0.34.4. Future promotion needs integration/version reconciliation; none is authorized here.
- No Production, real-user migration, dev/main promotion or 1.0. Keep #1027/#967 open; Diary #1029 follows core release.

## Implementation
- Expired access tokens previously failed Auth verification before refresh; writer shutdown also required the expired token to release its lease. New local pause cancels both RxDB writers first, retaining server authority. Rotation verifies the same owner, then releases the original lease and re-runs all startup guards.
- Ambiguous refresh/release failure leaves sync paused, local drafts and credentials intact, with one retry per normal catch-up. Unconfirmed local cancellation prevents refresh/restart; definitive refresh denial clears credentials and blocks uncertain handoff. The UI retains the owner during transient outages; terminal blocked recovery requires reload/sign-in, preserving local rows.
- Lease release is bound to its original owner. GoTrue's explicit HTTP 400 revoked/expired-refresh codes are distinguished from unclassified errors/outages. Manual sync retry uses the same recovery path.
- Core lab now uses 60-second JWTs only in its disposable local Supabase stack. New browser test observes an actually expired, previously accepted server JWT while offline, aborts the first refresh, retries, and verifies pending completion reaches the server and a second device. Hosted Auth policy is unchanged.

## Verification and environment
- Recovery `df574b72`: focused #39440410286 and real lab #39440410258 passed (all three browser/server cases). The test requires explicit server expiry text with 401/403 and checks all browser-issued tokens. Live Auth readback confirmed numeric `code` plus symbolic `error_code`; parser/test corrected. Late provider-unmount completion also stops the new writer.
- Local baseline: 314 files / 2103 tests, plus 26 recovery tests and targeted Preview tooling tests. Isolated Supabase build/PWA/blocking sizes and reconstruction of 175 identical static files passed. Final combined source still needs focused, lab/artifact, stable canonical acceptance and actual deployment evidence.
- Hosted baseline `--ui` run `defe11f80a976cb7fa409fb5` passed actual CRUD/order/offline/second-device/owner isolation plus signed security checks and fixture retirement. Runbook: `supabase-poc/HOSTED_CORE.md`.
- Only Supabase target: `mosaic-dev` / `hcxtiifzxoaflhjgoglb`. Management and Auth-policy readback work. Email confirmation/refresh rotation enabled; leaked-password protection disabled. Existing guarded migrations are installed; never rerun empty-project rollout.
- User confirms Scratch Appwrite `6a96e82d000d1310b3be` is suspended after free-tier exhaustion; no credentials/console until reset. Oracle VM/endpoint/project are not provisioned. Do not request unavailable Appwrite credentials repeatedly or substitute Production.
- `VERCEL_TOKEN` is ready; exact Mosaic project readback returned 200 (`prj_jysOLDbuO9c5rP8x6Q145DVIw0fc`, team `team_UbpudOr8jXyrDA5SdVUxVGOr`). Separate Supabase Preview artifact now builds with public-only inputs after the real lab, with source/provider/origin/key-digest evidence. Standard trusted Preview still selects Appwrite; its receiver rejects the Supabase artifact.
- Planned isolated alias `mosaic-supabase-core-preview.vercel.app` was unassigned. Environment draft adds this hostname; user must publish it before cloud browser access. No deployment is claimed yet. Hosted runner can test deployed bytes with exact SHA/provider checks before login; shared Vercel variables/protection/aliases stay unchanged.

## Next action
- Complete focused checks and real expiry lab, commit/checkpoint, squash to the named stable branch only after green, then canonical acceptance. Record remote outcomes in #1027; no status-only post-green commit.
- Deploy exact independently verified Supabase CI bytes after stable acceptance, read back READY/source/provider and assign only the isolated alias. Run signed hosted UI/retirement against that deployment once its hostname is allowed. Runbook: `supabase-poc/HOSTED_CORE.md`.
- Remaining MVP: persistent offline cold-start/cross-tab recovery, conflict UI, old Appwrite writer fencing/identity mapping, reversible three-backend transfers preserving drafts/tombstones/revisions, encrypted restore and mobile acceptance. Live cross-provider tests await functioning Scratch and Oracle installations.
