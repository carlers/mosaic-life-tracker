import React from 'react';

/** Rarely opened keyboard reference; keep out of the Day View/Home static closure. */
export const DayKeyboardHelpShortcuts: React.FC<{ isBacklogView: boolean }> = ({ isBacklogView }) => (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <dt className="font-mono text-gray-100">↑ / ↓</dt><dd>Previous / next task or category</dd>
        <dt className="font-mono text-gray-100">Home / End</dt><dd>First / last visible item</dd>
        {!isBacklogView && <><dt className="font-mono text-gray-100">← / →</dt><dd>Previous / next day outside text editing</dd></>}
        <dt className="font-mono text-gray-100">S</dt><dd>Focus the Select tasks button</dd>
        <dt className="font-mono text-gray-100">N</dt><dd>New task in the focused category (not in Select mode)</dd>
        <dt className="font-mono text-gray-100">Enter</dt><dd>Edit a task; select it in Select mode</dd>
        <dt className="font-mono text-gray-100">Space</dt><dd>Complete a task; select it in Select mode</dd>
        <dt className="font-mono text-gray-100">Shift+Enter</dt><dd>Task actions (outside Select mode)</dd>
        <dt className="font-mono text-gray-100">?</dt><dd>Show this help from a task or category</dd>
        <dt className="font-mono text-gray-100">Tab</dt><dd>Move through other controls</dd>
        <dt className="font-mono text-gray-100">Esc</dt><dd>Cancel editing or close the active overlay</dd>
      </dl>
);
