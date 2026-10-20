# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 persistent offline restart and browser-tab session coordination; candidate v0.32.2.

## Accepted baseline and scope
- Stable `feature/1027-supabase-recovery-20261020@bfe8e1355dc06f0b714d69ade119fd48dd0aeb79`, PR #1115, v0.32.1. Canonical #39451594885 and Supabase app lab/artifact #39451594936 passed. Live isolated Preview: https://mosaic-supabase-core-preview.vercel.app, Vercel `dpl_CSBQtqBXqz2naXLx3bS73rE4UTAR`.
- Both deployed UI/conflict/security runs passed; all fixtures retired. Approved temporary Vercel access was revoked and SSO protection unchanged. Exact evidence: #1027 comment 6293773081.
- Task `codex/1027-supabase-recovery-offline-20261021` starts from that source. PATCH 0.32.2 has no active collision. Dev 0.36.3/main 0.29.1 checked; future promotion requires integration/version reconciliation.
- No Production, real-user migration, dev/main promotion or 1.0. Keep #1027/#967 open. Diary #1029 follows core release.

## Implementation
- `supabaseBrowserSession` serializes durable refresh transactions through Web Locks, reads the newest refresh token, stores only refresh credentials plus a separately verified local owner cache, and fences stale tabs by browser family. Access JWTs/passwords stay in memory. Unsupported locking/storage retains memory-only behavior.
- Cached personal data renders during offline startup or background Auth checks. Remote writers still require signed Auth, canonical mapping and server lease guards. Restore outages retain credentials/drafts; confirmed denial clears the family. Access-JWT expiry requests renewal rather than erasing the refresh family.
- View teardown pauses local writers without logging out sibling tabs. Explicit logout retains guarded shutdown. Cross-tab changes clear the visible owner; task/category writes also synchronously check the provider-neutral family fence before dispatch. Account replacement requires reloading the stale tab.
- Completed core replication marks owner offline-data readiness; Sync Status uses provider-neutral reachability text. No backend schema or Auth policy change.
- Added real browser `offline cold start` acceptance and `hosted-core.mjs --offline`: installed shell/offline reload, acknowledged local edit/reload, reconnect/second-device convergence, shared-tab rotation, tab close, logout and account isolation. Fixture retirement is reported after verified readback even on failed tests.

## Checks and limits
- Related Auth/domain/UI tests: 239 passed; the additional storage-failure case and 6 documentation contracts passed. TypeScript/lint and Supabase build/PWA/blocking size budgets passed; existing advisory overruns remain warnings.
- Hosted offline/security run `387e9880b3b67fe8c38a71e5` passed reload/edit retention, reconnect/second-device convergence, shared-tab rotation, tab close, logout and account isolation. All 4 users retired; zero live rows. Earlier test setup failures also retired fixtures. Additional write-after-rotation/logout assertions await CI.
- Exact-source focused/canonical/local-stack CI and deployed acceptance are pending. Physical installed Android/iOS PWA behavior remains untested.
- Only hosted backend is mosaic-dev `hcxtiifzxoaflhjgoglb`; migrations already installed, never rerun `--apply-empty-project`. Environment Supabase/Vercel credentials and required network hosts are working. Operator evidence/scripts remain in `/workspace/mosaic-preview-operations/`.

## Remaining MVP gates
- Hosted signup/recovery (confirmation enabled, localhost site URL, no custom SMTP), existing-user mapping and old Appwrite PWA cutoff, reversible three-installation transfers with pending edits/tombstones/revisions, encrypted restore, physical mobile acceptance and discard-device/use-cloud conflict choice.
- Scratch Appwrite is suspended by exhausted free-tier limits; Oracle VM/endpoint/project unprovisioned. Do not request unavailable credentials repeatedly or substitute Production.

## Next action
- Push the reviewed coherent focused task commit with this checkpoint. Require task focused + real Supabase lab, then squash to stable for canonical/lab acceptance. Deploy verified exact CI artifact, verify deployed behavior and revoke any explicitly approved temporary access. Update #1027 evidence without a status-only post-green source commit.
