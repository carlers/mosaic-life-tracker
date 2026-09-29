# Category reorder mobile acceptance

Run this check in the installed PWA or a mobile browser with at least three
categories. It intentionally uses a real touch gesture because browser pointer
emulation does not reproduce every native scroll and bottom-sheet recognizer.

1. Open **Categories**, touch the first category's grip, and drag it past at
   least one sibling. Verify the row follows the finger for the full movement
   rather than stopping after a few pixels.
2. Release the grip, close **Categories**, reopen it, and verify the reordered
   category position persisted.
3. Start a vertical swipe on the category row outside its grip. Verify the
   sheet content scrolls normally and no category begins reordering.
4. Drag a category by its grip vertically in both directions. Verify the
   category reorders and the Categories bottom sheet does not begin or complete
   its dismiss gesture.
