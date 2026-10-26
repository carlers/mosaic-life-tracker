# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 detached Ed25519 server-witness verification for all seven Appwrite owner source domains, branch `chatgpt/1027-appwrite-signed-source-fullcheck-20261026`.

## Accepted and protected
- Production Appwrite; `main` bef14fb791a361e8c1f902a5c4adf4536e57aae7 and `dev` 497919bed4b6ce85b826f2d86fc767920344ec17 remain untouched. No hosted private Supabase Bucket/Settings SQL, live writer/provider switch, backup R2 mutations/schedules, alerts/pruning, social or user data touched.
- Previously verified real Scratch seven-table R2 age backup 20261025T031343499Z restored on Fedora with native >=30-day retention. Do not repeat. User wants ONE final SHA-pinned all-pre-social Fedora acceptance after automatable code.
- Isolated recovery `257cc03e9d124d85c9e0524eab612b857f7645e4` accepted Bucket/link RLS and ten-table encrypted DR #1328-30, isolated Bucket/link RxDB #1333, historic link quarantine/age readback #1334-35/#1338, owner double-source readers #1337/#1340/#1341, replay+photo parity #1339/#1342, old installed Appwrite PWA direct-write fence preflight #1344 and GET-only owner ACL admin inventory #1346. #1348 added independently pinned X25519 encrypted exact original ACL restore ledger and real synthetic decrypt/negative validation; all SOURCE-ONLY and inactive.
- #1348 corrected full-diff focused Quality #40269168771 PASS, dedicated real age #40269168755 PASS. Stable recovery exact `257cc03`: synthetic #40269335913, history age #40269335945 and new ACL age #40269335855 PASS; Quality, 8/10-table, GoTrue, Core technical running at last readback; Preview approval separately protected.
- Disposable Appwrite Scratch Cloud project `6a96e82d000d1310b3be` PAUSED, service APIs return HTTP 403 project_paused. No service resumed or hosted owner data accessed.

## Current scope
- `supabase-poc/appwriteSignedFrozenAuthority.ts`: strict canonical Ed25519 detached lease verification with out-of-band pinned public SPKI SHA, owner, exact Appwrite deployment, nonce, generation, 1h maximum expires, seven signed server counts, ACL snapshot, signed old-PWA HTTP 403 matrix and actual server writer-fence receipt pins. Reject foreign signer, signature mutation, stale/future/long tokens, wrong source, owner, counts, lease and unknown fields. Only verified lease objects are used by `readPinnedAppwriteSevenDomainSource` to invoke both signed two-pass history and complete task/category/Diary/Settings readers, rechecking every page before owner source join.
- New `tests/unit/supabaseAppwriteSignedFrozenAuthority.test.ts` uses disposable Ed25519 signing and synthetic seven-domain owner pages; no live cloud or authority key. Still `actualBackendWriterFreezeConfirmed:false`, `providerCutoverEligible:false`, external trusted signer/issuer NOT INSTALLED. First task #1349 focused checks failed due synthetic unit fixture name typo before real proof assertions; corrected coherent task CI PENDING.

## Next action
- Run full-diff task focused Quality, fix, squash into isolated recovery after green; verify exact stable canonical and never auto-approve Preview.
- Implement authorized Scratch server-exclusive owner-write fence with encrypted ACL rollback, admin/Function/key revocation and real signed old PWA 403 including stale offline outbox; independently authenticated full personal/Storage/ZIP source age R2 archive, exact two-owner Supabase replay, Settings/Bucket offline/two-device behavior, reverse Appwrite Cloud/Oracle↔Supabase migration, real ten-table PG17/Auth/Storage DR. One final consolidated Fedora command; Production requires explicit approval.
