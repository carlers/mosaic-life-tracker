# Session checkpoint
Updated: 2026-10-26 Asia/Manila
Current task: #1027 user approved a mosaic-dev-only three-table rollout AFTER fresh encrypted backup, independent restore and security validation. Task branch `chatgpt/1027-ten-table-r2-publisher-20261026`.

## Verified source and live state
- Recovery stable `feature/1027-supabase-recovery-20261020@11bb37baa5fc17b6dc805df6bebf55c925fec37f` (v0.47.0). `dev@497919bed4b6ce85b826f2d86fc767920344ec17`, `main@bef14fb791a361e8c1f902a5c4adf4536e57aae7` Appwrite, unchanged. CI same SHA Quality, full signed GoTrue (after fixed disposable Storage), eight-/ten-table, original-media/ACL/owner and synthetic restored labs all PASS; Core App protected Preview still waiting reviewer approval.
- Read-only hosted Supabase mosaic-dev `hcxtiifzxoaflhjgoglb` active. Only tasks/categories/Diary public candidate tables, owner RLS. Settings/Bucket/link tables absent. Four publicly exposed authenticated-only CAS/core RPC Security Advisor warnings have empty search_path and no anon execute; need signed 2-owner negative evidence. Password leak protection warning outstanding.
- Previous real Fedora seven-table R2 encrypted snapshot native >=30-day retention and isolated restore accepted for October 25, NOT fresh prior to this schema rollout. Appwrite Scratch remains paused, old-PWA writer fence unproven.

## Scope and authority
- User's 2026-10-26 approval applies to hosted `mosaic-dev` additive personal Settings/Bucket/task-link schema **only if** a genuinely fresh, source-authenticated encrypted PostgreSQL + private media backup is independently restored and tenant security is verified. It does not approve Production, dev/main, protected Preview bypass, scheduler/pruning, or provider switch.
- Current task fixes unified-offsite marker parser: it incorrectly allowed only seven/eight, while ten-table backup would upload encrypted archive parts then reject completion. Match exact ten recovery-profile export; test complete paired R2 marker/download/verification and malformed inputs. No live writes, credentials, jobs, or hosted release in source task.

## Next action
- Source task focused Quality, squash to isolated recovery, exact-SHA full restore/Quality. Then establish FRESH pre-change encrypted seven-table hosted source+Storage backup and independent recovery using protected credentials/workflow without weakening main/reviewer/DR gates. Confirm actual 30-day native lock and retain existing generation. If protected environment cannot run safely via connectors, do not apply schema; request one last approval/access action only if actually blocked.
- After pre-change recovery green, apply exact additive SQL to mosaic-dev only, run signed two-owner owner/RLS/CAS/lease/private Storage negative probes and independent fresh ten-table R2 backup+restore before calling remotely supported or activating six-domain personal app. No one-off Fedora commands; user wants ONE final complete all-pre-social machine acceptance. Preserve existing Appwrite PWA data until lossless provider cutover.
