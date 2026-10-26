# Session checkpoint

Updated: 2026-10-26 Asia/Manila
Current task: #1027 read-only complete Appwrite admin ACL/row/Storage/Function source reader, task `chatgpt/1027-appwrite-admin-acl-readback-20261026`.

## Accepted/protected
- Production remains Appwrite, main `bef14fb791a361e8c1f902a5c4adf4536e57aae7`, dev `497919bed4b6ce85b826f2d86fc767920344ec17`, hosted Supabase Bucket/Settings SQL, R2 backups, SMTP/pruning/social and user data untouched. Protected Preview requires separate approval.
- Historic real Scratch encrypted 7-table R2 age snapshot 20261025T031343499Z independently restored on Fedora, native >=30-day lock verified. Do not repeat; user expects ONE final consolidated pre-social Fedora command once all automatic work is done.
- Isolated recovery `f87df36cc13cb60fa41229e8717545c3d16c3306`: signed private Bucket/link SQL #1328; PG17 10-table age DR #1329; signed Bucket transport #1330; isolated RxDB #1333; complete link history/quarantine #1334; age ledger #1335; signed full Appwrite owner source #1337/#1340/#1341; age readback #1338; Bucket replay parity #1339; private historical photo/byte parity #1342; complete old-PWA Appwrite writer ACL freeze PRECHECK #1344. All remain source-only.
- #1344 replacement full-diff focused Quality #40263434923 PASS incl 10 security tests. Exact stable f87df36 Quality #40263568799, 8-table #40263568636, 10-table #40263568710, GoTrue #40263568940, age history #40263568688, synthetic #40263568707 PASS; Core App #40263568900 waiting on protected Preview stage.

## Current source-only development
- `scripts/appwrite-source-grant-readback.mjs`: real GET-only *callable library* for an independently approved Appwrite admin read requester. Reads full six personal TablesDB table grants, all signed-owner rows' per-row permissions, the private task image bucket and complete Storage file ACL listing, and Function scopes. Independently pinned complete owner row/count and photo IDs required. Two bounded, owner-fenced, keyset/total-confirmed no-cache scans must byte match. No admin key, live endpoint or scheduled job used by this task.
- `tests/unit/supabaseAppwriteAdminGrantReadback.test.ts`: synthetic read-only REST harness plus ACL drift, foreign/missing/duplicate rows, source file/Function count and attack cases. CI not yet accepted.
- Returns acl evidence only, expressly `ownerFileMembershipIndependentlyAuthenticated:false`, `authenticatedSourceLeaseIssued:false`, `privilegedWriterKeysRevoked:false` and `providerCutoverEligible:false`. Existing Appwrite row/file create+update grants and enabled write-capable Function still allow old clients; the tool does not revoke them.

## Next action
- Exact full task focused Quality and repair; squash into isolated recovery on green; verify stable canonical Quality/real GoTrue/PG17/age checks. No hosted Preview/prod change.
- Implement reversible encrypted ACL-grant rollback, real authorized Scratch server-freeze proof+old-PWA 403 denial, trustworthy owner Storage linkage, authenticated complete full source archive and byte restoration, idempotent cross-provider replay, two-device offline Settings/Bucket/ZIP convergence and Appwrite Cloud/Oracle↔Supabase exclusive-writer cutover dry run. Final only ONE SHA-pinned Fedora acceptance; Production release separately approved.
