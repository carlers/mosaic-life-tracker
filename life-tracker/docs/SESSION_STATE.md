# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 isolated Supabase RxDB-native task/category push/pull bridge, not a provider switch.

## Source and authority
- Current accepted isolated Preview before task: `refactor/967-signed-local-auth-ci-20261019@5adbf59c64465909947ba819c393fbe576ea8526`; canonical #39193008552 and trusted prebuilt READY #39193150849 SUCCESS.
- Task branch: `chatgpt/967-rxdb-native-pilot-20261019`, based on that exact isolated SHA. Unshipped source-only POC + tests/docs only. No production Appwrite, shipped Mosaic runtime, Vercel env, provider migration, Auth accounts, cloud schema, protected dev/main or user data changes.
- Issue #967 remains OPEN. Last genuine signed Auth/REST/CAS local integration #39192772712 SUCCESS; two hosted Supabase privileged-RPC Advisor WARNs remain, hosted signed users still untested.

## Changes in this task
- Add `supabase-poc/candidateRxdbPilot.ts` composing candidate pull, create/master and server-revision CAS through RxDB's native `replicateRxCollection` interface for owner-mapped tasks and categories only.
- Use provider-scoped replication identifier distinct from Appwrite and native RxDB pull/push checkpoint persistence; no duplicate checkpoint store.
- Guard session epoch/token through each page/batch; deny foreign owner writes and hard deletion. On no-assumed-master create, compare against remote first to recognize a response-lost idempotent replay; no timestamp last-write-wins. On assumed master, require server equality then CAS its actual server revision. Divergent master, missing expected server row or competing CAS throws `CandidatePendingConflictError` to keep local changes pending rather than allowing RxDB's default master-wins behavior to overwrite offline edits.
- Native RxDB wiring uses waitForLeadership, 100-row pull, 20-row push, retryTime 5s and explicit resync/stop. No Realtime. No dual-writer activation in app.
- Unit tests cover bootstrap and assumed edits, real-precision CAS, stale or ambiguous outcomes, owner switches, tombstones, foreign rows and wiring.
- Evaluation doc differentiates this source-only bridge and the still-unproven actual Dexie/IndexedDB persistence on device/browser restart.
- Security consistency: candidate pull/HTTP transport now requires modern `sb_publishable_` keys, matching create/CAS/probe and rejecting potential legacy JWT service-role keys. Add negative unit coverage.

## Verification
- Task final focused [verify:focused] requested on coherent code+test+doc commit; actual result pending. Stable isolated Preview canonical and trusted delivery pending. No claim of browser-persistent or hosted signed acceptance yet.

## Next action
- Run focused task tests, repair source/types/fixtures as necessary; squash into fresh isolated stable Preview, run canonical full Quality Gate and trusted delivery. Record exact SHA in #967.
- Next: isolated real RxDB/Dexie restart + actual signed local Supabase Auth endpoint, pending offline writes/conflict queue tests and explicit merge/resolution design; protect hosted security and review the two SECURITY DEFINER warnings. Do not promote dev/main, touch Production, or release 1.0 without explicit separate approval.
