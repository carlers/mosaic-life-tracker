# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 source-only frozen Appwrite full-owner history reader, task branch `chatgpt/1027-appwrite-owner-history-reader-20261026`.

## Accepted / protected
- Production still Appwrite; Git `main` bef14fb791a361e8c1f902a5c4adf4536e57aae7 and `dev` 497919bed4b6ce85b826f2d86fc767920344ec17 unchanged. No hosted private Supabase Settings/Bucket SQL, live writer or provider switch, SMTP alerts, backup pruning, user-data mutation or social rollout.
- Historical seven-table real Scratch R2 encrypted archive 20261025T031343499Z restored on Fedora with >=30-day native retention lock; do not repeat. Owner requires ONE final full pre-social trusted Fedora invocation after all pre-social migration and DR prepared.
- Isolated recovery head `a9bea887d347433a8291276f22b01e7b170581c1`: merged #1328 owner-private Bucket SQL, #1329 10-table PG17 age exact restore, #1330 signed Bucket read/create/CAS, #1333 isolated Bucket/link RxDB, #1334 complete link history classifier, #1335 age-encrypted owner history ledger. All source-only.
- Exact stable `a9bea887` full Quality #40251467742 PASS (targeted rerun repaired a nondeterministic unrelated Todo drag test without changing source), owner age lab #40251467750, synthetic restore #40251467737, eight-table #40251467769, ten-table #40251467817, GoTrue #40251467740 PASS. Core App technical job #40251467759 is completed; full workflow waits for protected Preview approval, not automatic release.

## Current change
- `supabase-poc/appwriteOwnerHistoryRead.ts`: dormant **read-only** guarded Appwrite SDK owner-row scanner. Requires trusted server writer-fence lease, exact installation ID, verified account and app owner generation, checks each around every page. Scans tasks (identity/tombstone only), Bucket List, links twice with owner filter, keyset ID paging and exact server total; refuses foreign/duplicate/incomplete/mutated/long-overflow responses and account/lease rotation. Keeps soft tombstones and all valid 255-character historical task IDs. No ZIP, Provider or Production writer activation.
- New behavioral fixture `tests/unit/supabaseAppwriteOwnerHistoryRead.test.ts` mocks signed page/lease/owner situations; final focused Quality gate not yet verified. Source count and two passes do not independently authenticate an owner archive.
- `packOwnerBucketHistory` and offline age ciphertext writer remain accepted foundations, but **real frozen writer lease, authenticated complete full-owner source archive, source byte hash, media history, isolated backfill/replay and reverse provider migration** are all still pending.

## Next action
- Verify focused Quality at exact task SHA; repair issues, squash into isolated recovery, then full stable canonical CI; never approve hosted Preview or deploy from an unfinished branch.
- Implement trusted server-enforced exclusive writer lease, authenticated complete source with full task contents/media, private age snapshot + independent hash/replay, portable Settings/Bucket offline/device convergence, reversible Appwrite Cloud/Oracle ↔ Supabase single-writer migration and actual ten-table R2/Storage recovery. Then ONE SHA-pinned Fedora acceptance only.
