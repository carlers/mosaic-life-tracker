# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #889 release readiness / #526 historical-client compatibility preparation (read-only, isolated task).

## Live baseline and approval
- Protected dev `6d488d3c3b2ae0e998162d4fe70303fdfa58b964` v0.26.2; exact postmerge CI `38682390199` SUCCESS and hosted Preview READY. Protected main `a7d4c431eef6902f1d2d35271b6b8e41f8e9228e` v0.17.4; branch histories diverged (73/54), so no blind Production promotion.
- #889 read-only audit: https://github.com/carlers/mosaic-life-tracker/issues/889#issuecomment-6185653576
- Target working branch `chatgpt/526-production-compat-prep-20261015` based on exact dev. #872 previous historical-client checker was accepted but PR is stale/unmergeable against new dev; reconstruct on the current base, not by force-merging.
- Scratch union Function is already active `6ad04931c34b463de0b4`; Production active older Function `6acb8162dc02a1deaa23`. Production lacks Diary emoji/photos, Diary reactions, message Diary references and Bucket List tables. No new Scratch or Production writes authorized by this task.

## Authorized isolated scope
- Port read-only historical-client checker and unit regressions; expand it from strict read-row mapping to candidate write-payload shape checks (not equivalent to server authorization). Document Production old-client, backup, migration ordering and Function rollback acceptance gates.
- Do not change user-facing behavior, app version, app schema, migrations or Function. No GitHub dev/main merge, Appwrite mutation, Vercel project writes or release/tag.

## Next action
- Publish one reviewed task commit with `[verify:focused]`, inspect focused CI and fix actual regressions. After green, create stable Preview candidate and complete canonical/hosted acceptance without dev/main promotion. Report historical main client incompatibility separately; prepare exact additive rollout plan and request separate Production backend write authorization only after recovery and old-PWA gates are met.
