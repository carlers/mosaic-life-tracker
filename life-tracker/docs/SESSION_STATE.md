# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1004 permanent experimental dogfood Preview PWA handoff.

## Verified source and isolation
- `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` (v0.29.12); `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged.
- `feature/dogfood@e3327131546b1d4a9fe3a34f74968864ef871eb4` squash merge of [PR #1006](https://github.com/carlers/mosaic-life-tracker/pull/1006), version impact NONE.
- Three explicit direct dogfood→dev promotion guards and regressions, plus `docs/DOGFOOD_WORKFLOW.md`. No backend schema, Function, PWA implementation, protected-main, Vercel source policy, or Production change.

## Verified delivery
- Focused task Quality Gate [#39214446705](https://github.com/carlers/mosaic-life-tracker/actions/runs/39214446705) SUCCESS; stable dogfood full Quality Gate [#39215632119](https://github.com/carlers/mosaic-life-tracker/actions/runs/39215632119) SUCCESS.
- Trusted protected-main [#39215830876](https://github.com/carlers/mosaic-life-tracker/actions/runs/39215830876) receiver + prebuilt writer SUCCESS for exact SHA `e332713...`; Vercel `dpl_2YSk2g6uShRVmxWggXQxfZsmRm37` READY, Preview target null.
- Reserved stable alias `https://mosaic-life-tracker-dogfood-carls-projects-72516fde.vercel.app` assigned via Vercel connector, read back bound to that READY deployment. Main-owned writer itself never assigns aliases: connected operator repeats the verified alias handoff after each accepted dogfood update.
- Scratch Appwrite active, existing `*.vercel.app` platform present; exact hostname creation blocked by 403 Free-plan platform ceiling. No cloud schema changes or Production writes. Vercel SSO remains enabled for Preview URLs.

## Remaining verification / next action
- On task branch `chatgpt/1004-dogfood-alias-handoff-20261019`, document safe reproducible alias rotation and exact first-bootstrap evidence; request focused CI then squash to stable dogfood for a second full canonical/prebuilt candidate. Rotate the **same** reserved alias to the newly verified READY Preview and read it back, proving stable URL updates.
- Only user/device testing can confirm authenticated PWA install, local data persistence, Update now, offline reopen/reconnect and rejected-feature rollback; record results in issue #1004. Do not claim these from server status. Never promote dogfood→dev/main or release 1.0 without explicit approval.
