# Category manager date controls — issue #1912

## User interface

Category rows reserve width for long category names (one truncated line) and place optional Start/End date labels on a secondary line. A single More (three-dot) button opens a contextual nonmodal actions dialog containing **Edit category**, **Move tasks**, and **Delete category**. Escape, tapping outside and choosing an action close the dialog. All original guarded task-move and category-deletion confirmation flows remain.

The Create and Edit category forms put **Start date** and **End date** side by side when space allows and stack them on small screens. Both are inclusive. Start is prefilled with the current owner-local date for new categories; End is initially blank. Users can clear either date, including clearing End to restore an open-ended active category. A Start-after-End date is invalid and disables saving. Historical tasks remain accessible.

## Compatibility

Only presentation and form payloads change. Start maps to existing optional `startedOn`, End maps to existing optional `retiredOn` (remote `started_on` / `retired_on`), and both values are updated together through the already validated `updateCategory` domain hook. The *Ended* category filter keeps the old internal `retired` status. No Appwrite schema/Function migration, cross-account operation or backend activation is needed.

## Preview and validation

`v0.122.1` is the first user-testable refinement of `v0.122.0`. Test: action menu tap/Escape/outside close; long names; reorder; Start/End on create/edit; invalid ranges; clearing End; Upcoming/Ended filters; guarded move and deletion; day-view category shortcut; reload/sync and Light/Dark/Black/mobile. Preview is not automatically promoted to dev/main/Production.
