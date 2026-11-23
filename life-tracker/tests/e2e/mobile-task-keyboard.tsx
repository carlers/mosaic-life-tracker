import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { BottomSheet } from '../../src/components/ui/BottomSheet';

function Probe() {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(true);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState<string[]>([]);
  const commit = () => {
    if (draft.trim()) setSaved(current => [...current, draft.trim()]);
    setDraft('');
    setEditing(false);
  };
  return (
    <div className="h-dvh bg-background">
      <div data-testid="underlying-page">Home remains mounted</div>
      <BottomSheet
        isOpen={open} onClose={() => setOpen(false)}
        ariaLabel="Day View" height="full" contentMode="fixed"
        fitMobileVisualViewport dismissFocusedTaskInputFirst
      >
        <div className="flex h-full flex-col gap-4" data-testid="task-sheet-content">
          <button type="button" onClick={() => setEditing(true)}>Add another task</button>
          {editing && <input autoFocus data-task-inline-input data-task-creation-input
            aria-label="New task title" value={draft}
            onChange={event => setDraft(event.target.value)}
            onBlur={commit} />}
          <div data-testid="saved-tasks">{saved.join(', ')}</div>
          <button type="button" className="min-h-20" aria-label="Empty day view space">
            Empty space
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<Probe />);
