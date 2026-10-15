# Session checkpoint

Updated: 2026-10-15 UTC
Current task: #853 Edit-focus user-facing Preview pilot for #592 workflow validation.

## Baseline and approved scope
- Protected `dev@6d488d3c3b2ae0e998162d4fe70303fdfa58b964` v0.26.2 (full accepted CI/hosted Preview). Protected main `a7d4c431eef6902f1d2d35271b6b8e41f8e9228e` v0.17.4 unchanged.
- User approved #889 sequencing plan; #853 pilot scope recorded at https://github.com/carlers/mosaic-life-tracker/issues/853. Task branch `chatgpt/853-edit-focus-20261015` based on exact dev. Proposed first Preview version **v0.27.0** (no other open PR claiming it at task start).
- TaskItem already focuses a direct inline task editor. Fix TaskActionSheet's zero-delay edit handoff racing BottomSheet exit/focus restoration; focus the CategoryManager name field whenever Edit starts or switches categories. No layout redesign, backend/sync changes or new features beyond Edit focus.

## Verification and handoff
- Add regression coverage for sheet-exit edit sequencing and category Edit focus. Then one `[verify:focused]` task commit, focused green, squash into an isolated stable Preview for one full canonical gate and Vercel/Scratch-ready delivery.
- #526 historical-client tooling has separate accepted stable `refactor/526-production-compatibility-20261015@d78bc715f81b9e63f123d09fa7059d7f47f317d2`, full CI SUCCESS and Vercel READY; not promoted to dev/main. #889 remains production release coordinator.
- No task or stable PR is permission to merge to dev/main, activate Scratch/Production Appwrite, or tag 1.0.0. User performs real phone/keyboarding acceptance separately.
