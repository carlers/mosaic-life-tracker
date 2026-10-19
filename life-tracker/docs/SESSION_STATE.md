# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 isolated Supabase candidate pull-and-cursor atomicity, no live backend switch.

## Boundary
- Task source is accepted isolated `refactor/967-signed-auth-probe-20261019@aead4d2d7fca703a9fc19fcf43851d69b979ba5e`, [PR #988](https://github.com/carlers/mosaic-life-tracker/pull/988). Its focused #39183186956, canonical #39183492348, trusted delivery #39183650488 all SUCCESS.
- New task `chatgpt/967-atomic-pull-checkpoint-20261019`. No Mosaic app runtime import, cloud schema/Auth/users/rows changes, Appwrite, Production, dev/main promotion or version bump.
- Isolated Supabase Free `mosaic-dev` ACTIVE_HEALTHY at read; last observed 0 candidate rows and 0 Auth users. Two unresolved CAS SECURITY DEFINER Advisor warnings persist.

## Work
- Add source-only `supabase-poc/candidatePullCoordinator.ts` composing existing verified task/category pull, exact bigint revisions and legacy-to-UUID owner mapping.
- Introduce explicit store contract: document apply and checkpoint advance MUST be one atomic transaction, compare old checkpoint, reject pending local edits, fence account session generation inside commit, distinguish stale result without blind retry.
- Tests use a strict in-memory transactional fake to exercise two-page restart, tombstones, offline replay, crash/storage fault, concurrent pulls with stale loser, wrong owner, session switch during HTTP and commit, pending unacknowledged local edits.
- Update `docs/SUPABASE_EVALUATION.md` with exact research boundary and outstanding real RxDB/IndexedDB store + signed HTTP proof.
- Version impact NONE: no user-visible runtime change, no Vercel/Appwrite/Supabase provisioning changes.

## Verification
- Pending final focused task CI and separate stable Preview canonical/trusted delivery. Do not treat in-memory fake store tests as real persistent IndexedDB/RxDB or signed-user evidence.

## Next action
- Request [verify:focused] on coherent task commit; diagnose/fix any failing lint/tests. After focused green, squash into a fresh isolated stable Preview, run canonical full CI and trusted delivery, record exact-SHA evidence on #967. No dev/main promotion or real backend switch.
- Then implement actual persistent, transactional RxDB/local-storage adapter and new-row push/conflict-master flow. Genuine signed-user tests require authorized creation of two confirmed disposable `mosaic-dev` Auth accounts, not real Mosaic users. Keep #967 OPEN and preserve the two advisor warnings for independent security review.
