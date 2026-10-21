import React from 'react';
import { BottomSheet } from './BottomSheet';

/** One discoverable, always-current guide for app accelerators and keyboard navigation. */
const groups = [
  { title: 'Anywhere', shortcuts: [
    ['H', 'Go Home'],
    ['E', 'Explore'], ['A', 'Alerts'], ['C', 'Chat'], ['M', 'Me'],
    ['?', 'Show keyboard shortcuts'],
  ] },
  { title: 'Home', shortcuts: [
    ['F', 'Focus friend carousel'], ['← / →', 'Browse friends; Enter selects'],
    ['Shift + H', 'Open hamburger menu'], ['S', 'Open Sync Status'], ['/', 'Search tasks'],
    ['B', 'Open Backlogs'], ['T', 'Todo list'], ['D', 'Diary view'],
    ['V', 'Calendar view'], ['G', 'Focus calendar grid'],
    ['Page Up / Down', 'Previous / next calendar period'],
  ] },
  { title: 'Day View and Backlogs', shortcuts: [
    ['S', 'Focus Select button'], ['N', 'Add a task in focused category'],
    ['↑ / ↓', 'Move between tasks and categories'],
    ['Enter', 'Edit task'], ['Space', 'Complete task'],
    ['Shift + Enter', 'Task actions'],
    ['← / →', 'Previous / next day (Day View)'],
  ] },
  { title: 'Me', shortcuts: [['S', 'Open Settings']] },
];

export const KeyboardShortcutsSheet: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
  <BottomSheet isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" height="full">
    <div className="mosaic-sheet-text space-y-5 px-4 pb-12 pt-3">
      <p className="text-sm text-gray-400">
        Shortcuts work outside text fields and other open dialogs. Letters are not case-sensitive. Shift + H opens the Home menu.
        Turn off single-key shortcuts under Me → Settings → Preferences → Navigation.
        Tab, arrow keys, Enter and Space continue to work normally.
      </p>
      {groups.map(group => (
        <section key={group.title} aria-label={group.title}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{group.title}</h3>
          <dl className="divide-y divide-white/5 overflow-hidden rounded-xl bg-surface">
            {group.shortcuts.map(([key, description]) => (
              <div key={key} className="flex flex-row-reverse items-center justify-between gap-4 px-3 py-2.5">
                <dt className="shrink-0 rounded-md border border-[#333333] bg-surfaceHighlight px-2 py-1 font-mono text-xs font-semibold text-white">{key}</dt>
                <dd className="min-w-0 text-sm text-gray-300">{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  </BottomSheet>
);
