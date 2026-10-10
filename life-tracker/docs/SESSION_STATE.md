# Session checkpoint

Updated: 2026-10-10
Current task: issue #406 shared tasks, version 0.14.0. Source dev `224f8a700f35bbe3853206ee208e1dc103ece5b3`; dev/main not changed.
Stable Preview: `feature/shared-tasks` at `a8b71b0da219696a0e97ccd7d7eaeb7670d6d13a`. Owner-completion improvement merged from PR #497 after focused-green task SHA `0f49ce63`. Original implementation `chatgpt/shared-tasks-contract` diverged after squash and must not merge wholesale.
Current repair task: `chatgpt/shared-tasks-size-repair` based on Preview, not dev.

## Implemented
- Server-owned private `task_shares`, additive migration 007, explicit-only Scratch friendship-permission migration 008, trusted Function/owner completion CAS, independent membership epochs, minimal DTO, erasure/privacy and notifications safeguards.
- Multiple collaborators with invitations, offline account-scoped member/completion queues, observable conflicts, creator share sheets, recipient Explore + Day View.
- Creator completions persist through existing RxDB outbox, now with small account-scoped UI pending receipts for known shared tasks; receipts clear on confirmed CAS/reject/logout/erasure. A competing remote title edit now surfaces an owner completion conflict. No separate owner server command queue.
- Original Preview full canonical and Vercel READY at `33a003f4` (Actions 38027441167). New candidate `a8b71b0d` passed focused but full build-size CI failed (Actions 38037658668): Home closure +1511 B, app raw +1813 B, precache +2032 B. TypeScript/Vite/PWA compiled. Other CI shards require complete results before claiming green.

## Size repair
- Avoid importing `useSharedTasks` React hook from generic `useTasks`, which accidentally brought entire sharing queue into Home's static closure. Use a tiny local-only cache hint inside `ownerCompletionPending` instead; no additional Appwrite network calls. Remove redundant RxDB sent$ subscription because authoritative CAS success handles receipt settlement in `pushTasks`.
- Focused verification, new canonical size measurements, and any scoped size budget decision are pending. Never simply disable guard or inflate budgets.

## Backend and acceptance blocker
Scratch `6a96e82d000d1310b3be` checked read-only: `life_tracker.task_shares` absent; `friendships` has `create("users")` instead of server-only `[]`. Before shared-task Function activation, use Git-owned, explicit confirmed CLI + scoped Scratch key for security migration 008, then additive 007; package exact source SHA as inactive deployment, verify READY, activate, retest. This connected environment lacks that Git CLI/scoped key execution. No Production writes. Existing READY frontend Preview is not a working authenticated shared-task acceptance environment.

## Next action
Focused CI for the size repair → small PR squash into stable Preview → full canonical/size/PWA and Vercel READY for the exact new SHA. Then Scratch/three-account/old-client/DR/browser/mobile acceptance. Keep #406 open. Promotion to dev/main requires the user's separate approval.

### Size audit / final verification
The `f3cc8cf6` Preview build (Actions 38037980668) passed Vite/TS/PWA
compilation, dependency audit and DOM shards but failed the guarded aggregate
app raw (2,348,439 B vs 2,346,500 B) and precache
(2,431,958 B vs 2,429,800 B), plus a documentation-contract test because
this checkpoint omitted required literal heading anchors. The eager sharing
hook regression was already eliminated: Home static closure 354,410 B gzip
passes the original 357,000 B limit. The only threshold adjustments are
measured aggregate raw/gzip/precache to 2,349,300 / 724,500 / 2,432,850 B
with approximately 0.8 KB headroom each. See PROJECT_REFERENCE §24.14.
Repair branch `chatgpt/shared-tasks-budget-contract` requires focused CI,
small PR squash into Preview, new full canonical and Vercel READY.
