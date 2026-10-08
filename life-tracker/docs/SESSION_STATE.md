# Session checkpoint

Updated: 2026-10-08. Current work: integrate accepted `feature/semantic-versioning` into `feature/notifications-alerts` before dev promotion; task branch `chatgpt/alerts-versioning-integration` from accepted Alerts commit `54d292396c`.

## Objective and invariants

- Deliver a single stable Alerts Preview at **0.5.0** (prior standalone versioning Preview was **0.4.0**), preserving the existing Alerts implementation, scratch isolation and native Settings multiline commit disclosure.
- `dev` is an Appwrite Scratch Preview; only official `main` targets Production. Settings displays `appwrite:` from actual SDK project and endpoint, not from the Git branch.
- Production Appwrite mutation is **not authorized** by this implementation task. Current production `push_subscriptions` lacks `include_task_details`; reviewed `006-push-details` migration is required before production Function activation.
- Backend Scratch is shared with other Previews and is also a DR slot; no silent resets, scheduled GC or production-account copying.
- Normal workflow: final focused task verification, squash into accepted stable Preview, full canonical CI and Vercel READY, then review PR #387. User acceptance on the combined UI and remaining real-device Alerts retention behavior is distinct from automated tests.

## Implementation work

- Port versioning scripts, contracts and regressions while preserving Alerts appwrite tooling; bump package/lock/UI version together to 0.5.0.
- Bring the expandable commit message into Alerts Settings and add runtime-effective Appwrite identity.
- Harden Preview and official Production Appwrite target guards and test mismatched project/region/Function combinations.
- Reconcile agent workflow documentation and descriptive release merge requirements; keep the existing Notifications backend/function unchanged.

Next action: finalize focused task commit and run focused CI; merge into the Alerts stable Preview on success, then validate full CI and READY Scratch Vercel deployment. Do not assume device acceptance or production migration has happened.
