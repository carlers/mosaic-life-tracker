# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #857 category retirement and explicit task deletion; #1029 Diary transports; #1027 public core+Diary release.

## Source baseline / safety
- Reconciled branch `chatgpt/857-category-retirement-reconciled` starts from isolated stable Supabase beta `feature/1027-supabase-recovery-20261020@19e7bedd8fa1b2a363fe9050e26f49ae7116ceff`, which includes SQL-only Diary foundation and signed Diary transport primitives; Dia​​ry RxDB runtime/UI remain disabled. Task branch #857 `6d0eff05c530f64271c428a47be5b2b5808b55f1` passed focused Quality Gate #39653618727 but conflicted with concurrent Diary mapping; this branch reconciles rather than overwriting Diary fields.
- Current protected v0.32.5 Supabase task/category Preview exists; owner reports near-instant cross-device updates. Isolated Auth is still invitation-only; no public signup, hosted Diary schema, category retirement schema, Appwrite Production or newer dev/main changes.
- Scope: owner wants public personal tasks/categories/Diary release, retired historical categories, explicit destructive all-task category deletion, social/images postponed. Existing two orphaned beta tasks remain unmodified.

## This isolated Preview candidate
- v0.33.0 category lifecycle: RxDB categories v2 `retiredOn` migration, owner-local effective date, historical Day View, future/Backlogs task preservation, restore, separate typed category+tasks tombstone action, UI/behavior regressions. Signed Supabase category CAS `retired_on` additive migration staged for disposable CI only.
- Combined candidate mapping retains BOTH Diary signed transport and new categories retirement field; CAS preserves diary RPC allowlist and adds category `retired_on`. Appwrite rows default active; **Appwrite backend parity is not ready** for this feature. No hosted migration applied.
- IMPORTANT: destructive all-task deletion still has a multi-device race until server-side transactional owner-scoped cascade/guard is proven. Do not release publicly or deploy to live accounts without repair.

## Next action
- Run focused CI on reconciled branch, fix tests, then squash only to isolated stable followed by same-SHA full canonical and signed Core App Lab. Independently finish server-side task deletion atomicity and safe recovery of old orphans.
- Build third signed RxDB Diary writer, connect app and owner-fenced realtime, verify offline/concurrent/auth negatives before enabling UI. Perform backup/restore/provider return, client compatibility and public Auth abuse protection before any Production or signup gating change.
