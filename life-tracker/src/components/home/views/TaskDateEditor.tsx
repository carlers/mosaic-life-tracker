import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { TaskDateCalendar } from './TaskDateCalendar';

interface TaskDateEditorProps {
  initialDate: string;
  onSave: (date: string) => Promise<unknown> | unknown;
  onCancel: () => void;
}

/**
 * Date picker content is rendered in the currently active BottomSheet in the
 * very same tap. No transient browser activation, native showPicker(), timer,
 * or competing bottom-sheet history entry is required on iOS/Android/desktop.
 */
export const TaskDateEditor: React.FC<TaskDateEditorProps> = ({
  initialDate, onSave, onCancel,
}) => {
  const [date, setDate] = useState(initialDate);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const save = () => {
    if (!date || isSaving) return;
    setIsSaving(true);
    setError('');
    void Promise.resolve().then(() => onSave(date))
      .catch(cause => {
        setError(cause instanceof Error ? cause.message : 'Could not change date.');
      })
      .finally(() => setIsSaving(false));
  };

  return (
    <div className="space-y-4 px-4 pb-8 pt-2" aria-label="Change task date">
      <TaskDateCalendar value={date} onChange={setDate} disabled={isSaving} />
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} disabled={isSaving}
          className="rounded-xl bg-surfaceHighlight px-4 py-3 text-sm text-white disabled:opacity-50">
          Back
        </button>
        <button type="button" onClick={save} disabled={!date || isSaving}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-black disabled:opacity-50">
          <CalendarDays size={18} aria-hidden="true" />
          {isSaving ? 'Saving…' : 'Confirm Date'}
        </button>
      </div>
    </div>
  );
};
