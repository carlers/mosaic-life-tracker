# Session checkpoint

Updated: 2026-10-11
Current task: repair aggregate production build-size budgets for accepted granular release history v0.16.10 on dev. No main promotion authorized.

## Verified state
- User-approved release-history integration PR #565 merged into dev at `e912c4abab7f234ae35c8c051c897764a38ee07a`, version 0.16.10.
- Merge tree exactly equals accepted combined stable Preview tree `1093d670f45ba3469d9d42b1df61c0d6af217491`; full canonical Preview run 38113703778 SUCCESS, Vercel Preview dpl_Hd2QdBeQppvvjgXAqCajEXs91yNs READY.
- Dev promotion CI 38113841779 SUCCESS, but Vercel dev dpl_iQNvX9t17S3Zv3WpFKT7BguVY23s failed BUILD_UTILS_SPAWN_1 due only to three aggregate budgets, despite successful compilation/PWA.
- Dev measured app raw 2,400,745 B (old limit 2,399,000), gzip 741,191 B (old limit 741,000), precache 2,485,096 B (old limit 2,483,500). Entry, initial and Home budgets passed unchanged.

## Repair
- Budget-only tooling/test adjustment: app raw limit 2,401,300; gzip 741,800; precache 2,485,700, with 555–609 B measured headroom. Startup/Home caps unchanged.
- Preserve v0.16.10 app source, historical release data, previous checkbox fix, production publisher, Appwrite isolation and all backend behavior. No version bump for non-user-facing budget maintenance.

## Next action
- Require focused task CI success; squash into stable fix Preview `fix/release-history-dev-build-budget`.
- Confirm exact Preview canonical CI and Vercel READY, then merge accepted source into dev by approved correction PR.
- Verify dev CI, exact deployment READY, and no main change. Manual mobile/theme/offline acceptance remains unclaimed.
