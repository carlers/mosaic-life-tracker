# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1026 / #1027 staged core-only capability and reversible provider-return scaffolding; Diary next after core launch.

## Baseline and boundary
- Starting accepted isolated Preview: refactor/967-protected-fields-20261019@a68117b8f6ebbec8f4bad218915dc698bcd7eb75 (PR #1025, full #39233944325 SUCCESS; signed local #39233944204 SUCCESS; trusted Preview #39234212674 READY).
- Protected dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1, main@b952f71ecd2add3172f90104bc0e856a2648ccc9 unchanged. Default Appwrite shipped profile remains full. Supabase migration #967 and OCI Appwrite fallback #975 OPEN.
- No hosted Supabase Auth/schema/data, Appwrite/OCI, Production, VM auto-claim, provider environment switch, dev/main promotion or release. Approval to progress on isolated Preview only.

## Work included
- src/lib/backendCapabilities.ts: deterministic full/core-only build profile, central page capability mapping, core sync-domain declaration for tasks/categories (not yet wired to sync), provider-specific single-writer and reverse-switch verification assertions. Optional remote flags can only disable already supported capabilities; this module is not server authorization.
- Route registry, App.tsx guarded disabled deep-links (Coming Soon), BottomNav core-only alternative without social badge hooks, Home friend carousel/settings and Diary view suppression, plus shared task/friend/message providers and AppLayout notifications/chat push fast-path guards. Normal full profile behavior preserved by default.
- tests/unit/backendCapabilities.test.ts: default behavior, absent-provider remote flag denial, deep-link capability boundaries, cross-provider dual-writer rejection and symmetric verified Appwrite return acceptance.
- docs/CORE_MVP_PROVIDER_RETURN.md: planned reversible cutover including source snapshot, no unacknowledged drafts, independent restoration, historical Appwrite ID mapping, PWA writer fencing, reverse delta after Supabase writes, zero loss for deferred Diary/social.
- Issued #1027/#1026 and #967 priority comments: *Diary is the first immediate post-working-core feature*; do not wait for social. Back-migration to Appwrite (Cloud or OCI) must be rehearsed, no blind provider switch.

## Verification
- At checkpoint authorship focused CI, canonical stable Preview, trusted deployment and manual devices have NOT been run. No shipped Appwrite build or runtime Supabase integration proof.
- Core-only build profile is NOT a functioning new backend. Existing AuthProvider/sync still use Appwrite; settings/profile and other side effects need a further audit. Do NOT enable VITE_MOSAIC_FEATURE_PROFILE=core-only for real users before one-provider writer orchestration and Supabase Auth/hosted tests. The source-only cutover guard is not enforced by a production runtime writer.

## Next action
- Commit coherent task [verify:focused] on chatgpt/1027-core-capability-reversible-20261019, run focused verification, fix failures; create new stable isolated refactor/1027-core-capability-reversible-20261019 via squash PR and full canonical Quality Gate + trusted Preview READY; post exact issue checkpoint.
- Next executable batch: complete core-only **backend side-effect/sync exclusion** and secure Supabase Auth/identity binding, then wire task/category pilots to real app lifecycle, test signed hosted two-user, offline devices and lossless forward + reverse data migration. Keep Diary first after initial functioning MVP release, ahead of social.
- Do not promote dev/main/Production or release 1.0 without user approval and documented gates.
