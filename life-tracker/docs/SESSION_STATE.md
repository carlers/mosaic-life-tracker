# Session checkpoint

Updated: 2026-10-11
Current task: fix task completion checkboxes losing pointer clicks while a *different* inline task input is focused. Frontend-only Preview v0.16.8; no dev/main promotion authorized.

## Verified baseline and investigation
- Started from `dev` `b76ca6295a8409309c232b25d44fa7f63cbc6878` (v0.16.7).
- Issue #465 delivered same-row editor checkbox and inline new-task completion in v0.11.0. Existing tests never covered cross-task checkbox interaction.
- A blank add-task input closes on blur, changing rows from non-draggable to draggable and potentially replacing an unrelated checkbox between pointer-down and click. Another task's title edit can also save/unmount on blur.
- Owned/shared task checkbox pointer-down previously suppressed focus transfer only if *that row's* title was editing.

## Candidate
- Mark each inline task title input and suppress completion-button pointer focus-transfer blur when any such input is active, across owned and shared task rows.
- Preserve independent checkbox completion, pending drafts, edit-save semantics on ordinary blur, keyboard input and drag ownership. No layout, backend, or schema changes.
- Expand DOM regression coverage for a blank pending add row, a different edited owned task, and a received shared task. Extend the durable contract in `PROJECT_REFERENCE.md`.
- Preview version synchronized to 0.16.8.

## Verification and handoff
- Coherent task branch commit requests `[verify:focused]`. Focused CI, full stable Preview canonical gate, Vercel Preview and real mobile/device acceptance are not yet verified.
- Next action: inspect focused results; fix any failures before squash into `fix/task-checkbox-cross-input-focus`; then confirm exact stable Preview CI and Vercel readiness. No dev/main promotion without explicit approval.
