# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #592 default CI-first stable Preview rollout verified with #852 ordinary user-visible feature.

## Current gate and source identity
- Protected `main@bb58300052dc4c85974d97779e2b257ec4f28c7d`: owner-approved special infrastructure PR #894 merged; ruleset #24880070 active with zero bypass actors. Main full Quality Gate #38702258745 SUCCESS; exact Production deployment `dpl_3MoRfXuoz98wDBiivhoi731vBviv` READY, Production app v0.17.4 unchanged.
- Protected `dev@6d488d3c3b2ae0e998162d4fe70303fdfa58b964` v0.26.2 unchanged. #853 v0.27.0 accepted on isolated stable Preview, but not dev-promoted; avoid version collision.
- Main-owned trusted receiver now recognizes reviewed inherited byte-exact Git suppression, requiring official canonical CI, pinned producer blob/artifact, Scratch identity, PREBUILT-only CLI upload, no candidate execution/secret exposure, and at most one exact SHA provider creation. Other rules from #592 unchanged.
- The tested `dev`-based source-policy task `aa10ea6f` changes `life-tracker/vercel.json` to `feature|fix|perf|security|refactor/*: false`, preserving `dev/main: true`; focused CI #38698327093 SUCCESS.
- Ordinary frontend #852 task `49f34c0a` v0.28.0 adds Yesterday/date-context actions and component regressions; focused CI #38699831899 SUCCESS.
- This combined task source derives from exact `dev@6d488d3c` with both reviewed change sets (no Appwrite schema/Function changes); `chatgpt/592-852-ci-first-integrated-20261015` exists solely to run focused verification before a *first-commit* stable CI-suppressed feature Preview.

## Acceptance and next action
1. Focused gate on combined task SHA, fix any actual regressions; do not create an ordinary Git-first stable Preview.
2. Start a genuinely source-first single-leaf `feature/...` stable branch at the combined policy-carrying SHA; prove the **first push** creates ZERO Git-provider deployments. The main trusted writer may create only after exact full canonical success. If flags/alias/origin block delivery, investigate fail-closed and request the narrow owner action, not a Git-first fallback.
3. Inspect canonical gate/CLI READY/Scratch browser identity, stable URL, routing/PWA security and idempotent same-SHA retry. Device authentication/acceptance is distinct and user-owned. Keep owner-accepted #853 promotion and any future #852 stable→dev promotion under separate explicit approvals.
4. After #852, run second normal issue #851, then return to #889 #526 historical-client/Production migration/restore readiness; no Production backend or 1.0 promotion authority from this workflow phase.

No direct `dev/main` mutation or alias/provider settings change from this task.
