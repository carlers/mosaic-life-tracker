# Session checkpoint — #408 Diary v0.25.5 size-policy parity

Updated: 2026-10-15 UTC.
Current task: remove hosted build blocker for accepted-but-not-yet-device-tested Diary relative mixed ordering (#408), using the **already-approved #784** two-hard/five-advisory size policy. Stable parent: `feature/diary-408@d26dbac52ebf9878e4961bb50e039e483fe38434`. Isolated branch: `chatgpt/408-784-approved-policy-parity-20261015`.

## Verified context
- Implemented #408 task-neighbor Diary anchors, task before/after top Diary hit targets and reordering through PRs #878/#879/#882. Their stable full canonical Quality Gate #38674407972 passed, but hosted Vercel `dpl_5f9ryPFoRUyt8Uvzomm77Rc691v7` failed old all-seven budgets: raw app assets 2,507,519/2,506,500 B; PWA unique precache 2,596,102/2,595,000 B. Startup/Home 146,223/367,635 B passed.
- `dev` previously adopted #784's two blocking startup/Home budgets (154,500/381,000 B) with five advisory measures and regression coverage, based on a controlled mobile cold-load experiment and audit. The old Diary branch predates this policy. Do not weaken measured startup guards or PWA correctness.

## Change scope
- Backport **exact dev-tested** build-size guard, review contract and relevant regression suites; configure #784 previously approved 154,500/381,000 B startup/Home thresholds and both blocking names on Diary. Keep Diary's other five budget ceilings and full historic review chain, with new explicit #784 policy and size-limit provenance.
- No Diary/UI/drag implementation change, dependency/asset elimination, Appwrite schema/Function change, dev/main merge, Production change or version bump. Preserve Scratch active `message-action` union (Notifications/Diary/chat).

## Next action
Next action: Request focused CI for this coherent task commit; repair failures if any, squash into `feature/diary-408`; require exact stable full canonical CI and Vercel Scratch/GIPHY READY, registered alias and physical touch/desktop Diary drag acceptance before any dev promotion. Distinguish five advisory WARN measurements from hard failures; retain all seven reports. Do not close #408 or merge dev/main before user approval.
