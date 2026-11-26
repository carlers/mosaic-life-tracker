# #2298 cross-day dragging integration into Dev — v0.154.0

## Decision and scope

Owner approved the cross-day task/individual Diary entry/Diary group dragging Preview, then explicitly requested its Dev merge on 2026-11-26. Accepted cross-day-only source is stable feature v0.152.1 `a32c08245141456afeae5b3727bd618cb12de6b3`, Quality Gate [45751682982](https://github.com/carlers/mosaic-life-tracker/actions/runs/45751682982) SUCCESS and official READY Preview `dpl_5mCDb6Brcg4sRE4DnCNquo17fZmz`. Newer v0.152.2–v0.152.3 Diary hydration changes are not included in this approved integration.

The earlier direct promotion [draft #2584](https://github.com/carlers/mosaic-life-tracker/pull/2584) conflicts with Dev; do not merge it. This integration is instead based on current Dev `57820b69b9d392824882ab8ab34111ac4c93ad36` (v0.151.1), which includes the independently accepted mobile Calendar focus repair #2590. The new integrated Preview uses v0.154.0 to avoid published v0.152.x Preview identities and existing floating-navigation v0.153.0. Scope is Dev only; no Main, Production, Appwrite, backend, keys or schema changes.

## Conflict handling

Source-only files are imported by exact source Git blob SHA. Shared files with independent base-relative changes are merged, retaining both edits, without dropping Dev's Calendar, Review, search, Task/Diary, activity-grid, backup/restore, or other existing paths. For the conflicting `PersonPane.tsx`, preserve Dev's newer DiaryOwnerWorkspace route and its Today/widget/Calendar filter integrations; do not replace it with the source's older owner Diary entry sheet route. For the idle-preload conflicts, preserve Dev's `whenHomeIdle` path in `HomeTaskSearch.tsx` and `HomePage.tsx`. The accepted source's standalone `scheduleHomeIdle` helper remains available to the other source-owned consumers. Merge the independent component/docs index entries and pin the source-accepted dnd-kit 0.5.3 dependency versions.

Version is 0.154.0 in package, lock root and `appVersion.ts`; matching reviewed PWA release highlights describe cross-day gestures. Do not repurpose v0.152.1 or merge the 0.152.2–0.152.3 hydration changes.

## Gate before Dev promotion

1. Review the source/Dev overlap and exact Git-tree diff; preserve all baseline Dev-only edits.
2. Run focused checks on the integrated `chatgpt/**` task source; repair genuine failures without weakening checks.
3. Squash into one Dev-descendant stable `feature/**` Preview, run exact SHA full canonical acceptance and verify official Vercel Preview READY with Appwrite Preview `6ae94a2100014d01f5ed`.
4. Obtain a conflict-free stable Preview→Dev PR, run protected PR preflight, then merge a two-parent exact accepted-source tree.
5. Verify live Dev SHA, canonical acceptance and stable Dev alias deployment ID/SHA/project/READY. Do not report Dev delivered before alias readback.

## Consolidated regression scope

On phone and desktop Day View, test task and individual Diary entry/group drag to next/previous day (including repeated holds), destination category/order, Diary placement adjacent to other notes, cancel/Escape and outside drop, saved sync after reload, and source/destination date correctness. Also check existing Dev Diary workspace, Calendar filter/focus, Review, Home search, Widgets, and backup/restore integrity. Real-device dragging acceptance is not implied by automation.

## Next action

Continue scoped integration and CI through task → stable Preview → Dev; store live CI/PR/deployment status in GitHub Issue #2298. If branch ownership or external gates prevent a step, report its exact blocker without bypassing protections.
