# Session state

Updated: 2026-09-20
Current task: Portable Codex and DeepSeek workflow migration
Status: complete
Roadmap pointer: `PLAN.md` — workflow migration complete; Phase 3.4 next
Checkpoint: Both workflows share a verified neutral state and compact handoff contract.
Next action: Design the Phase 3.4 image-cache LRU access-time policy and byte budget.
Blockers: none

## Working set

- none

## Completed substeps

- Added explicit Codex, DeepSeek Chat 1, and DeepSeek Chat 2 workflow selection.
- Added state-driven compact packets with safe path overrides and Git checkpoint data.
- Retained DeepSeek's full-file installer, verification, rollback, and commit flow.
- Consolidated active workflow documentation and removed obsolete operational protocols.
- Untracked the generated Repomix snapshot while retaining Repomix as an audit fallback.

## Remaining substeps

- none for this migration; Phase 3.4 remains the next product batch.

## Temporary decisions

- Git supplies branch, HEAD, worktree, and commit truth; session state does not duplicate it.
- Dirty mid-batch handoffs are allowed only with complete files and explicit remaining work.
- Packets warn above an estimated 20,000 tokens and never embed repository exports.

## Verification

- Handoff unit coverage: 8 tests passed, including clean/dirty metadata and path safety.
- Codex, DeepSeek Chat 1, and DeepSeek Chat 2 commands completed successfully.
- Lint passed; 43 files / 415 tests passed; production build and SW guard passed.
- Markdown links, stale workflow references, instruction size, and `git diff --check` passed.
- Existing nested-button test output and large-chunk build warning remain unrelated.
