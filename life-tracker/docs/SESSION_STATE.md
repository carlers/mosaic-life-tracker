# Session checkpoint

Updated: 2026-10-22 UTC
Current task: #1250 urgent PWA ZIP + TodoMate catch-up migration into Supabase, with scoped TodoMate Replace.

## Verified baseline
- Isolated feature `feature/1027-supabase-recovery-20261020@3928d5a533e1a724cfb532e55f52a94ef72b8737` passed Quality Gate, Supabase Core App Lab, Synthetic Restore Lab and Real GoTrue Lab at exact SHA; `dev` separate.
- The fully authenticated but stale October 18 R2 snapshot has 5 eligible historical Auth accounts, 2,361 retained rows/121 retained files after deletion markers; actual source Appwrite Cloud data after Oct 18 remains unreadable at quota 402. No real-user source sync claim.
- Legacy personal ZIP/JSON (v1–v4) restore and TodoMate Firebase importer already implemented, but both still have hardwired Appwrite freshness and storage paths, not usable as-is on signed Supabase.

## Implemented in current scope
- User explicitly authorized TodoMate Replace with confirmation to avoid fuzzy ID matching. Add **scoped** `todomate-replace` to the existing restore engine: TodoMate tasks and categories replace newer/current-only records; Diary merges and other personal/social domains remain untouched. Download local safety backup before writes; apply all replacement rows before tombstoning missing rows. Only trusted in-memory TodoMate transfer can request the destructive mode.
- ConfirmSheet UI with Merge default; new engine and component regressions; update docs. This is an authorized *code implementation only*, not hosted release/data import.

## Next action
- Pass focused tests, version/preflight and full canonical CI; squash to isolated recovery Preview branch. Verify Preview delivery and manual ZIP/TodoMate flows when the actual signed Supabase import path is ready.
- **P0 remaining**: provider-neutral ZIP and TodoMate import preflight with signed Supabase authority (no Appwrite call), owner-scoped transaction/freshness check, secure local file preservation for unsupported domains, and real signed two-device acceptance. Legacy old-PWA server writer fence and trusted legacy identity verification are still required before declaring a full Appwrite migration. No real-user hosted import, dev/main/Production mutation or release without explicit approval. Keep #1027/#1250/#1029 open.
