# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #889 isolated preparation of an integrated pre-1.0 dev/main candidate preserving protected-main trusted delivery and dev v0.29.1 product/CI.

## Source and authorization
- Task base exact `dev@9b6319d956d59eafcef0357f97ccb02fd4075814` after user-approved #903; current Vercel dev exact READY and Quality Gate #38739248481 SUCCESS.
- Protected `main@bb58300052dc4c85974d97779e2b257ec4f28c7d` Production v0.17.4 remains divergent. No Production backend, Vercel environment, `main`, version, tag or release action authorized.
- Release audit #889 / #526 and isolated legacy v0.17.5 reader bridge `chatgpt/889-legacy-client-bridge-20261015@81bde2da` remain separate; focused run #38725371146 SUCCESS, no hotfix stable Preview or Production promotion.
- Preserve all user-accepted v0.29.1 Diary, notifications, chat, #851/#852/#853 and CI-first policies; no UI, product behavior, RxDB mapping/schema, Appwrite migrations/Function, package version or Vercel project-settings changes in this integration task.

## Integration choices
- Bring from actual protected main only the missing trusted PREBUILT sender/receiver/provider verification scripts and their tests/fixtures, archived trust bootstrap runbook, and newer guarded protected-main `trusted-preview-delivery.yml`, `trusted-preview-receiver.mjs`, `run-trusted-preview-receiver.mjs`.
- Keep dev's current pinned `.github/workflows/quality-gate.yml` blob `5f64f715551f0c311a60d823367d849dfb369bba`, its full artifact producer, current `preview-evidence-schema.mjs` diagnostic/ref contract and its `vercel.json` default stable Git suppression; do not downgrade it to main's older CI/Git-first policy.
- Keep dev's newer NotificationsPage test, main README/DELIVERY/SESSION conflicts unresolved by blind copy; link historical trust guide in docs index. Existing trusted main scripts must pass dev-focused tests and source contracts before a stable Preview or any protected promotion.

## Next action
- Run task [verify:focused], repair actual test/lint failures with regression coverage if needed, inspect exact diff and freeze one clean isolated candidate. Only then task→stable CI-first Preview full canonical and Vercel READY; approval required before dev/main promotion.
- #889 hard gates still pending: immutable old-client read/write/device/offline compatibility and upgrade/retirement, independent encrypted R2 completed/hash + isolated restore, Production schema 010–015 and Function rollout, authenticated two-account mobile acceptance and explicit main/release/1.0 approval. Do not copy Production data to Scratch.
