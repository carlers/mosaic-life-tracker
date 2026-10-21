# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #1187 Supabase core Realtime wake-up; related #1027 isolated beta, #1186 category orphan fix.

## Baseline and safety
- Task branch `chatgpt/1187-supabase-realtime-wake` starts at isolated core beta `feature/1027-supabase-recovery-20261020@de2556404fb3b9e957578a07f85704f1432d3f30`. Dev and main are separate Appwrite histories; current dev app version exceeds the beta's v0.32.5. Never merge this old beta tree to dev/main or change Production.
- #1186 task-preserving category deletion + inherited visibility fix at `de255640`; exact-source Quality Gate #39632216908 SUCCESS; Supabase Lab #39632216759 was still running when #1187 started. v0.32.5 not deployed, so no Preview version bump during this unreleased candidate refinement.
- Owner verified invited Gmail signup/confirmation/password recovery, uninvited HTTP 403, two-device CRUD, reorder, offline/restart/reconnect and Android PWA; iPhone Safari and post-update PWA refresh manual gate still pending.
- Hosted Free mosaic-dev `hcxtiifzxoaflhjgoglb` uses invitation-only Auth hook; Supabase Realtime publication exists but does not yet include candidate tasks/categories. Protected immutable v0.32.4 Vercel Preview remains on older code and aliases/SSO must remain untouched until independently authorized.
- Hosted read-only orphan audit: 2 live tasks under the owner's confirmed Gmail account still reference deleted category rows; task data untouched. No direct repair without signed, reversible verification.

## Current implementation
- #1187 implements owner-scoped Supabase Phoenix v1 websocket subscription for only `INSERT`/`UPDATE` of candidate tasks/categories, sends JWT only in channel join, checks signed owner ID + session epoch + token before waking existing authenticated RxDB replication; no event payload applies data and no DELETE subscription because DELETE bypasses Realtime RLS.
- Adds debounced wake-up, rejoin/missed-event fallback, 20-second heartbeat with idle timeout, explicit teardown on account switch and provider pause, plus unit protocol tests. Existing 60-second/online/focus catch-up remains.
- Adds isolated-only, idempotent `20261021_core_realtime_publication.sql` guard migration refusing absent owner RLS, unsafe grants or publication; CI disposable database installs and verifies migration. **Not yet applied to hosted** while source/CI/security tests are pending.
- No new paid plan, service key, project alias, Appwrite, Production, dev/main, general beta release, or live user data change.

## Next action
- Focused Quality Gate, repair TS/DOM/SQL failures, then squash into isolated beta branch and run same-SHA canonical Quality Gate + Supabase Core App Lab with artifact.
- After security review and green evidence, apply only the reviewed publication migration to isolated mosaic-dev; verify effective owner RLS with 2 actual signed users, authenticated websocket delivery, missed-event/reconnect fallback and Free quotas. Do not claim near-instant sync before real cross-device device test.
- Separately design signed, idempotent recovery for 2 existing orphan tasks; do not overwrite real beta user's tasks with privileged direct SQL. Use exact CI artifact prebuilt Vercel deployment only and verify before offering beta URL.
- Keep #1027/#1186/#1187 open pending deployed/manual/DR checks; Diary #1029 follows accepted core beta.
