# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #975 faster, cost-aware OCI GitHub private scheduler polling.

## Verified source and boundary
- Isolated accepted stable `refactor/975-github-a1-autoclaim-20261019@8a64727d029b373051c22ebc72bf93f59ca80c25`: task PR #996 focused #39187536875 SUCCESS, stable full #39187654569 SUCCESS and trusted Preview #39187802747 SUCCESS (exact SHA READY).
- No separate private scheduler repository or OCI keys/quotas verified via connected tools; no scheduler activation or VM. Owner's last known OCI status was OUT_OF_HOST_CAPACITY at 2026-10-19T01:07:01Z.
- Protected Mosaic `main@b952f71ecd2add3172f90104bc0e856a2648ccc9`, `dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1` remain outside #975; Appwrite/Production/Scratch, user data and Supabase #967 unchanged.

## Scoped work
- Standalone private-scheduler template defaults to GitHub cron twice hourly (UTC :17/:47) rather than once hourly.
- Opt-in `MOSAIC_OCI_FAST_POLL=true` allows ten additional cron events per hour to achieve an *attempted* five-minute cadence. These extra jobs skip without that variable, avoiding their runner-minute charges.
- Synthetic workflow contract tests pin both cron strings, 5-minute union, opt-in condition and default-disabled launch. Existing OCI A1 one-shot launch safeguards are unchanged.
- Operator runbook records GitHub Free's shared 2,000 monthly private minutes and minimum round-up: ~1,440 runs/month for 30-minute, ~8,640 for 5-minute (more if jobs exceed one minute); cron may skip/delay.
- No additional GitHub secrets, OCI rights, external resources or Mosaic app version impact.

## Next and approval
- Focused quality gate on task SHA → squash to isolated stable Preview only after success → full canonical gate and trusted READY. Do not promote to `dev`/`main` or activate VM provisioning.
- Owner still must create private `carlers/mosaic-oci-a1-scheduler`, pin the accepted source SHA in its workflow template, create dedicated limited OCI IAM/quotas and GitHub Actions secrets and verify observe-only run. Fast polling is optional and may exceed free Actions minutes; automatic VM launch remains separately gated by explicit owner approvals.
- Keep #975 open. No claim of actual scheduler/OCI activation.
