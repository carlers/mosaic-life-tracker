# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1047 — main-only trusted CI-first Preview deployment title metadata.

## Boundary
- Parent/source is protected Production `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` (v0.29.1); this is a **draft proposal branch only**.
- Version impact NONE. No application files, Appwrite, Production deployment, alias, Git integration settings, runtime feature flags or workflow configuration changed.
- Approved stable Preview source is `refactor/ci-first-preview-commit-titles-1047@f81e13cbef9b7588eb16b0f3497ca77cc1e40ba6`; canonical full CI and Vercel acceptance must be verified separately.
- NO main merge/Production operation without separately explicit owner-approved narrow workflow exception and all repository release/provenance gates.

## Proposed changes
- Only protected writer + its pure Vercel contract and two regression test modules, using content proven identical on original dev and main.
- Exact accepted GitHub SHA commit metadata is passed via CLI to improve dashboard labels; no rebuilds, routes, extra files, aliases, provider project changes, or version updates.

## Verification
- Integrated dev feature task commit `7fc32d2d2c5aebbb1122d65aea6443f870699a16` focused CI #39296476373 SUCCESS.
- Stable Preview commit `f81e13cbef9b7588eb16b0f3497ca77cc1e40ba6` under full canonical acceptance; do not assert success until checked.
- This main-only draft has no Production effect. Runtime Vercel dashboard label remains unverified until a new Preview uses the amended protected writer.

## Next action
- Verify this task's focused checks; review its four-file diff and exact main parent. Require owner approval for an exceptional narrowly scoped protected-main PR merge that is **not** dev/main app promotion. After approved deployment, inspect first new trusted Preview's exact provider metadata/dashboard title and close #1047 only on confirmed acceptance.
