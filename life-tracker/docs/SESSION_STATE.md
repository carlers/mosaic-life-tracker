# Session checkpoint — issue #408 Scratch compatibility

Updated: 2026-10-12.
Current task: activate Scratch-only compatible diary v0.25.1 Function while preserving #708 live chat reconciliation.
Next action: run exact Scratch migration 015, deploy reviewed combined Function inactive, verify READY, activate with retained rollback, then perform synthetic two-user acceptance.

- UI Preview stable `feature/diary-408@b5b3507c29d01c2200878d136a92b646d9e6e8ec` (v0.25.1) at https://mosaic-life-tracker-git-feature-788f0b-carls-projects-72516fde.vercel.app is Vercel READY; all seven hosted size budgets pass.
- Scratch project ONLY: `6a96e82d000d1310b3be`, FRA endpoint. Existing active `message-action` Function `6aa8057f002a4c306fdd` deployment `6accddcbede4ccb26900` includes #708 delivery repair. Preserve this deployment for rollback. New diary source alone must NOT replace it.
- This compatibility task branch starts at diary stable SHA and replaces only `appwrite-functions/message-action/main.js` with a **clean, conflict-free Git three-way merge** of base `09b905b693159b14c27cdae605288bfb84295691`, active source `8c5afc787dca7a4c8d214f0b24a0e82991fd5f71`, diary stable `b5b3507c29d01c2200878d136a92b646d9e6e8ec`; exact merged Git blob `28168fb29d980b5b05c717687c8e5e55aceb1eae`. Retains `repair_thread_all`, safe delivery, new `get_owner_diary_reactions`, typed quote, diary reaction activity.
- Added existing #708 repairThread handler regression tests to diary branch; combined focused #708/#408 suite 31/31 PASS. Full handler suite before adding #708 tests 183/183 PASS. No Production or dev/main changes.
- Required additive change: optional default-empty `messages.diary_ref_id` (36), `diary_ref_owner_id` (36), `diary_ref_date` (10), `diary_ref_excerpt` (160) in Scratch `life_tracker.messages`, matching Git migration 015. Never reset data.
- Remote gate status at authoring: Scratch columns missing; Function not yet deployed. Retain old deployment and inspect exact revision before activation. Backend edits are explicitly authorized by the user; do not mutate Production.
- Two-account cross-device acceptance, master sync convergence, and GitHub canonical branch check cannot be presumed from offline handler tests. Keep issue #408 open until acceptance.
