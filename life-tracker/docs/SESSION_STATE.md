# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 offline independent encrypted owner-history readback, branch `chatgpt/1027-owner-history-decrypt-proof-20261026`.

## Accepted isolated source and safety
- Production remains Appwrite. Git `main` bef14fb791a361e8c1f902a5c4adf4536e57aae7 and `dev` 497919bed4b6ce85b826f2d86fc767920344ec17 unchanged; no hosted private Supabase schemas, live writers, SMTP alerts, backup pruning, social rollout, R2 mutation or provider cutover.
- Historical Scratch seven-table R2 age backup 20261025T031343499Z was restored on Fedora with native >=30-day retention. No additional Fedora micro-tests: owner requires exactly ONE final bundled pre-social migration/DR acceptance command.
- Isolated recovery `470460839204db297b4913a2cf7ea87a72d9ac38` includes signed Bucket SQL (#1328), 10-table PG17 age restore (#1329), owner Bucket read/create/CAS (#1330), isolated Bucket/links RxDB (#1333), complete-owner link classifier (#1334), encrypted private history writer (#1335), and guarded two-pass owner-history Appwrite read (#1337). All source-only, none activated.
- #1337 prior incremental task #1336 focused verified only a checkpoint file; corrected single coherent PR #1337 SHA b41bbf62b6789afaf6b8ae970fab173bf3f0e4c3 focused Quality #40254080629 PASSED including 11 new unit tests; stable `47046083` Quality #40254253091 PASSED, encryption #40254246329 and synthetic #40254246357 PASS, other restore/Core technical workflows at last check pending; protected hosted Preview awaits separately approved promotion.

## Current implementation (source only)
- `supabase-poc/verify-encrypted-owner-history.mjs` offline reads previously encrypted 0600 age archive from a private source directory. Checks independently supplied ciphertext, original manifest, complete source snapshot and target identity SHA256 pins, exact signed-owner mapping and counts, reads/decrypts with private age identity only to memory, never writes plaintext, returns only verified metadata.
- Checks original link identity fields, exact order/uniqueness, 255-char legacy task IDs, tombstones, quarantine reason validity, rejects foreign/malformed/duplicate rows even when encrypted manifest SHA matches.
- Extended real synthetic age lab tests positive exact decrypt, wrong archive/source/target/count/owner hashes and a separately age-encrypted duplicate link. Exact task CI pending; **no live user data or hosted backend contacted**.
- Still missing actual SERVER-issued read-only/fenced provider lease, authenticated full owner content+media archive, genuine encrypted private retention/readback, source→destination replay and count/hash proof, reversible migration and two-device offline sync.

## Next action
- Verify exact focused and age lab CI; repair and squash to isolated recovery only on green; confirm full canonical CI, excluding protected Preview approval.
- Complete trusted source writer fences + full owner auth/content/media provenance, signed historical replay/ZIP/photo parity, real ten-table PostgreSQL/Auth/Storage DR, reversible Appwrite Cloud/Oracle ↔ Supabase exclusive-writer dry runs and one final pre-social Fedora acceptance. No dev/main/Production promotion without separate explicit approval.
