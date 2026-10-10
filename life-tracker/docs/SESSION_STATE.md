# Session checkpoint

Updated: 2026-10-11
Current task: Automate safe GitHub branch hygiene (three days after PR merge/promotion).
Baseline: dev at 60fe24b7852d420ee9c0915ed597ee61bc71801b.
Task branch: chatgpt/branch-hygiene; stable Preview: feature/branch-hygiene.
Scope: internal GitHub Actions/scripts/tests/documentation only; no app version,
Appwrite changes, Vercel behavior changes, or automatic dev/main promotion.

## Changes and safeguards

- GitHub Actions daily main-branch scheduled sweep plus manual dry run (default).
- Task refs expire 72 hours after the latest qualifying successful PR into
  a stable Preview, and stable Preview refs 72 hours after the latest successful
  PR promotion into dev.
- Exact PR head/branch SHA match, protected main/dev, open PRs on either side,
  strict branch-type/base allowlists, fresh pre-delete rechecks, and a
  100-deletions-per-run ceiling. Unproven orphan branches are never deleted.
- Relevant files: .github/workflows/branch-hygiene.yml,
  life-tracker/scripts/cleanup-merged-branches.mjs,
  life-tracker/scripts/lib/branch-hygiene.mjs,
  life-tracker/tests/unit/branch-hygiene.test.ts,
  and docs/DELIVERY.md.

## Verification and next action

Review the coherent task diff and run focused CI on its final task commit.
After focused green, squash PR into feature/branch-hygiene and verify the
full canonical Preview acceptance. No Vercel/production deployment or dry-run
execution has been verified at this checkpoint. Schedule will only become
active on default-branch main following separately authorized dev/main promotion.
