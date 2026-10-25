# Session checkpoint

Updated: 2026-10-25 Asia/Manila
Current task: #1027 provider-neutral personal Settings parity and eight-table encrypted recovery proof.

## Existing accepted systems
- Production Appwrite Cloud main bef14fb791a361e8c1f902a5c4adf4536e57aae7; dev 497919bed4b6ce85b826f2d86fc767920344ec17; isolated Supabase candidate feature/1027-supabase-recovery-20261020. No hosted Settings schema/writer.
- Seven-table actual Scratch R2 generation 20261025T031343499Z successfully remote byte-verified, decrypted and restored on Fedora to a fresh PG17/GoTrue with owner privacy; independent whole-bucket synthetic photo recovery and Cloudflare >=30d native lock GET readback passed. It did NOT contain Settings and is NOT eight-table proof.
- Brevo email alerts remain DISABLED; owner opened support for Gmail-free authenticated Brevo-managed sender with Proton Reply-To. Settings Reply-To code is isolated PR #1312, not deployed.
- Settings model/RLS/CAS and signed disposable two-owner GoTrue source proof accepted in PRs #1313/#1314; the Core App lab passed the signed Settings step. No live Settings parity or Bucket List/task links yet.
- Owner requires NO piecemeal Fedora commands. Finish all personal domains, full encrypted DR and reverse migration rehearsals in connected CI; then deliver ONE SHA-pinned resumable pre-social Fedora operator command. Separate device and Production approvals still apply.

## New source-only eight-table recovery
- PR #1316 added strict --fresh-personal-settings-sha256 for eight distinct Auth/core/Diary/Settings data objects, with source/target COPY byte equality and tombstones/revision checks. Old accepted 6/7 modes preserved; Settings source in older mode fails closed. No hosted SQL or R2 objects changed.
- This task adds a disposable GitHub eight-table restoration workflow. It seeds real synthetic Settings through signed GoTrue, encrypts a full PG17 archive with age, stops the source, restores into a different isolated PG17 through the reviewed operator restore driver and checks real signed owner/tombstone/privacy; cleans resources. Do not claim it passed until actual stable CI evidence.
- Hosted SQL remains unapplied; source-only feature, no Production, dev/main, provider, data, alert, schedule or pruning changes.

## 2026-10-25 deterministic unified R2 fixture time repair
- Fixed Oct 25 noon `NOW` in offsite synthetic tests drifted >60s from production real `completedAt`, triggering correctly strict future rejection and failing stable Quality #40192610581. Derive test NOW and stale/future dates from the actual current clock; NO changes to production 60s future guard, 36h freshness, retention, native lock or R2 objects. New eight-table signed age restore lab #40193150240 runs separately.

## 2026-10-25 live eight-table lab CI evidence
- New lab #40193150240 ran real signed Settings synthetic source, complete age encryption+auth, strict SHA-pinned 8-table separate PG17 restore with exact source/target COPY parity: those markers PASSED. Final foreign-CAS check failed only due PostgREST's all-null composite RPC result (same shape recognized by accepted `personal-settings-signed-local.mjs`), not evidence of row mutation. Fix assertion to accept ONLY true no-row null/all-null composite and independently reread original owner row afterward, demanding exact value, tombstone, revision remain unchanged. Entire real lab remains NOT ACCEPTED until full rerun green.
- Stable Quality clock fixture repaired in PR #1318 without changing R2 freshness/pruning logic.

## Next action
- Run focused CI, merge source-only lab into isolated recovery branch and verify the exact new full synthetic encrypted eight-table lab plus canonical Quality/GoTrue. Resolve failures. Then extend operational R2 backup/watch/restore to new personal data and implement owner-scoped Settings sync; continue Bucket List and migration portability before one final Fedora command.
