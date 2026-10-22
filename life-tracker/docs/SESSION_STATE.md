# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1027 fresh original-owner signed-read on a separately restored Fedora disposable target.

## Verified milestones
- Stable isolated Supabase feature `feature/1027-supabase-recovery-20261020@768505a493b89b1b6d9cbc9b8caff6f6bbbab350` has FOUR exact-SHA green workflows: Quality Gate #39763061158, Core App #39763061167, Synthetic Restore #39763061240, Real GoTrue Restore #39763061205.
- Owner on Fedora reported fresh encrypted hosted `mosaic-dev` snapshot restored to a DIFFERENT isolated loopback-only PG17 target with **403 exact six-table source/target rows** verified, no old session/lease replay. The earlier private original-snapshot disposable recovery also passed signed original-password/owner negative tests and remains preserved.
- Read-only hosted SQL on 2026-10-22: 81 Auth users, 81 identities, 81 authorities, 49 revisions, 53 categories, 58 tasks; 184 Auth sessions, 228 refresh tokens, 150 old leases, zero Storage objects/buckets. Hosted Diary table, category retirement column and atomic category-delete triggers are still ABSENT. These are catalog/count observations, NOT full hosted exact row/managed settings equality.
- Fresh-snapshot recovery is PASS for six core tables ONLY; platform Auth/SMTP/external settings, complete archive replay, old Appwrite migration and writer cutoff, reverse migration, user devices, public Auth and promotion remain open. Neither encrypted backup nor either Fedora recovery instance may be touched.

## Task scope
- Add guarded operator-only signed REST verification against exactly a local `~/.mosaic-private-recovery-XXXXXXXX` project: validate local Unix-socket Docker/loopback-only container/port, obtain browser publishable key from locally running CLI, terminal-private original password, freshly signed GoTrue identity+authority lease, SQL-versus-RLS task/category counts, and a cross-owner row denial.
- Strictly no hosted endpoint, no non-loopback URL, no secret key, no output of credentials, tokens, emails or UUIDs; only positive PASS labels. Freshly signed Auth session and writer lease are local disposable test effects.
- Unit coverage for strict local key parsing, refused arbitrary target and refused redirects. No Vercel/hosted schema/Production mutation.

## Next
- Verify focused CI, squash to isolated stable, exact-SHA four workflows. New private-Fedora owner invokes the signed read (requires an original password for an account with at least one live task); report only sanitized PASS labels.
- Independently audit managed Auth configurations/full encrypted archive restoration and old-PWA Appwrite writer fence before any live Diary/retirement/atomic-delete schema install. Hosted staging, public signup, device tests, isolated core-diary Preview and release require independent gates and approvals. Keep #1027/#1029/#857 open.
