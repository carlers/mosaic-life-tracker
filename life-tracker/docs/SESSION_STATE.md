# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 verify GitHub repository Supabase credential after cloud environment editor failures.

## Accepted implementation
- Core app v0.32.0: `refactor/1027-supabase-core-app-20261020@052a4658b55e25bc5b34a416c923fe604f0a3339`, merged PR #1079.
- Canonical #39412036803, real Supabase UI/security lab #39412036661 and trusted frontend Preview #39412277835 SUCCESS. Exact evidence and remaining MVP work: issue #1027 checkpoint 6289391812.
- Actual UI fresh-account Auth, task/category replication, offline completion/deletion replay and multi-device isolation work in the disposable real-server lab. Hosted Preview still selects Appwrite. Existing-user migration, old-PWA cutoff, offline reload/token recovery, conflict UI and hosted security/DR remain unfinished.

## Current verification
- User supplied SUPABASE_ACCESS_TOKEN through GitHub repository Secrets as a workaround. Cloud token previously reached Supabase but lacked projects_read; later environment-editor saves failed. Never print or copy credential values.
- GitHub secret metadata listing returns 403 for this integration; this does not establish secret absence.
- New Supabase Management Readiness workflow runs without checkout, exposes the repository token to one inline step only, refuses redirects and performs only GET api.supabase.com/v1/projects. Reports whether the isolated development project is accessible. No SQL, Auth policy or user-data writes.
- Task `codex/1027-supabase-access-20261020`, based on the accepted app source. Version impact NONE: credential diagnostic only.

## Next action
- Inspect the exact task readiness and focused runs. If access passes, record it in #1027 and continue scoped hosted development-project inspection. Deliver tooling through the normal isolated stable Preview path after focused acceptance.
- No Production, real-user migration, dev/main promotion or 1.0. Preserve the accepted app source and existing disabled capabilities. Diary #1029 follows the working core release.
