# Session checkpoint
Updated: 2026-10-22 Asia/Manila
Current task: Fix two owner-reported large-screen #404 v0.42.0 regressions and deliver an isolated v0.42.1 Preview.

## Baseline and scope
- Accepted Calendar large-screen v0.40.5 and repaired category-color v0.41.0 remain on dev@31be0286812ed52f86caaaa68541ae1e351aa671; dev Vercel READY. Main/Production unchanged.
- Preview v0.42.0 from PR #1202 is stable at feature/404-todo-diary-panel-v042-20261022@acd7a4828540e662d2114ce5c75442279180a4e6, Quality Gate 39708270937 SUCCESS and Vercel dpl_4RwLy1dNqmc7idDbZTF3b675TKtN READY.
- Two owner-reported bugs: live Full screen height → Calendar height can leave the panel taller than the workspace; while dragging the divider, reorderable tasks/categories/diary rows lag behind layout.

## v0.42.1 repair candidate
- Task branch chatgpt/404-height-resize-motion-20261022 from accepted Preview v0.42.0.
- Height measurement now derives exclusively from the Home workspace bottom relative to the active frame top. Never feed back the panel-inflated frame height after switching screen/grid modes.
- Divider changes the panel width custom property directly each animation frame and commits React state/persistence only at drag end; FLIP transforms for task/category/diary reorder rows are suspended only during the resize gesture. Preserve normal drag/reorder animations outside resizing.
- Real-browser height-toggle and divider/row geometry regressions accompany the fix; do not weaken any tests, size/security budgets or settings.
- Planned Preview v0.42.1 PATCH. Verify task browser gate, then squash only into existing protected stable Preview; require exact-tree canonical gate and Vercel READY before sharing for visual acceptance.
- Issue #404 remains OPEN. Do not promote to dev/main/Production without separate approval. Manual authenticated touch/editor-draft checks outstanding.
