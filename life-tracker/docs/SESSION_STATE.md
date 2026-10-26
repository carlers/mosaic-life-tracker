# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 same-frozen-owner seven-domain Appwrite source join on task branch `chatgpt/1027-seven-domain-source-join-20261026`.

## Accepted and protected
- Production remains Appwrite; Git main `bef14fb791a361e8c1f902a5c4adf4536e57aae7` and dev `497919bed4b6ce85b826f2d86fc767920344ec17` untouched. No hosted Supabase Bucket/Settings SQL, writer, provider cutover, SMTP alerts/pruning, social or R2 user changes.
- Real seven-table historical Scratch R2 backup 20261025T031343499Z restored on Fedora and native >=30-day retention verified. User explicitly requires ONE final consolidated pre-social workstation command after automated preparations. Do not repeat known good local checks.
- Isolated recovery `ace6cf15fddcc5957afc1ea9dbf3fd9c84a2fc45`: signed private Bucket SQL #1328; ten-table PG17 age DR #1329; authenticated Bucket pull/CAS #1330; isolated Bucket/link RxDB #1333; owner-link quarantine #1334; private age ledger #1335; three-domain Appwrite source reader #1337; independent age decrypt #1338; Bucket target equality #1339; **complete content tasks/categories/Diary/settings owner readback** #1340. All source-only; no hosted/Appwrite personal writer activated.
- #1340 exact full-diff focused Quality #40256416532 PASS incl 12 new tests, stable Quality #40256565198, history age #40256565247, synthetic #40256565188, eight-table #40256565228 and ten-table #40256565189 PASS. Stable real GoTrue #40256565206 first attempt FAILED: disposable password re-login HTTP 502 right after db reset, while exact six-table data restore PASS; one failed-job rerun requested. Core App workflow staged technical and protected Preview state must be verified separately; do NOT imply Production/Preview acceptance.

## Current source-only task
- Extend `appwritePersonalSourceRead.ts` output with independent server frozen counts for task/Bucket/link domains and bind them into provisional `scanSha256`.
- New `appwriteFrozenPersonalJoin.ts` validates same owner mapping, Cloud/Oracle target, lease generation and exact original IDs/tombstones across the history and full-content scans; rehashes all seven datasets; rejects post-scan memo/Diary photo/settings/permissions modifications, foreign/duplicate/omitted rows and identity/count drift. Always `fullEncryptedSourceAuthenticated:false`, `providerCutoverEligible:false`.
- New `tests/unit/supabaseAppwriteFrozenPersonalJoin.test.ts` and updated content-reader test. No backend/network calls. Exact task CI **not yet verified**; source-only changes need focused+stable checks before acceptance.

## Next action
- Run full-diff focused task Quality, fix failures, squash to isolated recovery when accepted. Verify canonical GoTrue rerun and all recovery labs, without protected hosted Preview approval.
- Then actually implement trusted server-enforced old-writer/offline-PWA exclusive lease, independent authenticated full-source encrypted task/category/Diary/Settings/Bucket history+photo byte archive, controlled row/photo replay and reverse-provider acceptance, two-device offline convergence and real ten-table R2/Storage recovery. ONE final Fedora batch only after pre-social prerequisites; separate Production approval.
