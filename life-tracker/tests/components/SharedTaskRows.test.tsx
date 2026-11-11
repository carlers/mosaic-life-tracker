import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharedTaskRows } from '../../src/components/home/views/SharedTaskRows';
import type { SharedTaskItem } from '../../src/lib/taskShareQueue';

vi.mock('../../src/hooks/useFriends', () => ({
  useOptionalFriendList: () => [{ friendId: 'owner_A', friendDisplayName: 'Alex' }],
}));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

const row: SharedTaskItem = {
  id: 'shr_a', taskId: 'task_a', ownerId: 'owner_A', status: 'accepted',
  grantEpoch: 'grant_a', membershipRevision: 'm1', completionRevision: 'r1',
  completed: false, title: 'Shared presentation', date: '2026-10-11',
  allowTitleEdit: true, allowDateEdit: false,
};
const categories = [{
  id: 'cat_B', name: 'Personal planning', color: '#ffffff', order: 0,
  userId: 'user_B', isDeleted: false, visibility: 'private' as const, updatedAt: 'now',
}];
const baseProps = { items: [row], categories,
  pendingFor: () => undefined, onSetCompleted: vi.fn(), onLeave: vi.fn(),
};
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('received shared task interactions', () => {
  it('opens the task actions on title activation without three-dot or grip controls', async () => {
    const assign = vi.fn(async () => {});
    const copy = vi.fn(async () => {});
    render(<SharedTaskRows {...baseProps} categoryFor={() => ''}
      onAssignCategory={assign} onCopy={copy} />);
    expect(screen.queryByRole('button', { name: /manage shared task/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /drag shared task/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('combobox', { name: /^Assign shared task to my category:/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Personal planning' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(row, 'cat_B'));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    await waitFor(() => expect(copy).toHaveBeenCalledWith(row, 'cat_B'));
  });

  it('keeps the checkbox independent from title interactions', () => {
    const toggle = vi.fn();
    render(<SharedTaskRows {...baseProps} onSetCompleted={toggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(toggle).toHaveBeenCalledWith(row, true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('toggles shared completion without blurring a different focused task input', () => {
    const toggle = vi.fn();
    render(<>
      <input data-task-inline-input aria-label="Other task draft" />
      <SharedTaskRows {...baseProps} onSetCompleted={toggle} />
    </>);
    const input = screen.getByRole('textbox', { name: 'Other task draft' });
    input.focus();
    const checkbox = screen.getByRole('button', { name: 'Mark complete' });
    expect(fireEvent.pointerDown(checkbox, { pointerType: 'mouse' })).toBe(false);
    fireEvent.click(checkbox);
    expect(toggle).toHaveBeenCalledExactlyOnceWith(row, true);
    expect(input).toHaveFocus();
  });

  it.each([
    { allowCheckboxes: true, keepFocus: true, toggles: true },
    { allowCheckboxes: true, keepFocus: false, toggles: true },
    { allowCheckboxes: false, keepFocus: true, toggles: false },
    { allowCheckboxes: false, keepFocus: false, toggles: false },
  ])('applies creation checkbox preferences to received tasks: allow=$allowCheckboxes keepFocus=$keepFocus', ({
    allowCheckboxes, keepFocus, toggles,
  }) => {
    const toggle = vi.fn();
    render(
      <div
        data-task-checkbox-preferences-scope="true"
        data-allow-task-checkboxes-while-adding={String(allowCheckboxes)}
        data-keep-task-input-focused-on-checkbox={String(keepFocus)}
      >
        <input aria-label="New task title" data-task-inline-input data-task-creation-input />
        <SharedTaskRows {...baseProps} onSetCompleted={toggle} />
      </div>
    );
    const input = screen.getByRole('textbox', { name: 'New task title' });
    input.focus();
    const checkbox = screen.getByRole('button', { name: 'Mark complete' });
    expect(fireEvent.pointerDown(checkbox, { pointerType: 'touch' })).toBe(false);
    fireEvent.click(checkbox, { detail: 1 });
    expect(toggle).toHaveBeenCalledTimes(toggles ? 1 : 0);
    if (toggles) expect(toggle).toHaveBeenCalledWith(row, true);
    if (keepFocus) expect(input).toHaveFocus();
    else expect(input).not.toHaveFocus();
  });

  it('allows keyboard activation after a blurred pointer attempt', () => {
    const toggle = vi.fn();
    render(
      <div
        data-task-checkbox-preferences-scope="true"
        data-allow-task-checkboxes-while-adding="false"
        data-keep-task-input-focused-on-checkbox="false"
      >
        <input aria-label="New task title" data-task-inline-input data-task-creation-input />
        <SharedTaskRows {...baseProps} onSetCompleted={toggle} />
      </div>
    );
    const input = screen.getByRole('textbox', { name: 'New task title' });
    input.focus();
    const checkbox = screen.getByRole('button', { name: 'Mark complete' });
    fireEvent.pointerDown(checkbox, { pointerType: 'touch' });
    expect(input).toHaveFocus();
    fireEvent.keyDown(checkbox, { key: 'Enter' });
    fireEvent.click(checkbox, { detail: 0 });
    expect(toggle).toHaveBeenCalledExactlyOnceWith(row, true);
  });

  it.each([
    { allowCheckboxes: true, keepFocus: true, toggles: true },
    { allowCheckboxes: true, keepFocus: false, toggles: true },
    { allowCheckboxes: false, keepFocus: true, toggles: false },
    { allowCheckboxes: false, keepFocus: false, toggles: false },
  ])('applies the same preferences to another shared task while editing a title: allow=$allowCheckboxes keepFocus=$keepFocus', async ({
    allowCheckboxes, keepFocus, toggles,
  }) => {
    const otherRow = { ...row, id: 'shr_b', taskId: 'task_b', title: 'Shared follow-up' };
    const order: string[] = [];
    const toggle = vi.fn(async (item: SharedTaskItem, desired: boolean) => {
      await Promise.resolve();
      order.push(item.taskId === otherRow.taskId && desired ? 'toggle' : 'unexpected-toggle');
    });
    const edit = vi.fn(async () => { order.push('blur'); });
    render(
      <div
        data-task-checkbox-preferences-scope="true"
        data-allow-task-checkboxes-while-adding={String(allowCheckboxes)}
        data-keep-task-input-focused-on-checkbox={String(keepFocus)}
      >
        <SharedTaskRows {...baseProps} items={[row, otherRow]}
          onSetCompleted={toggle} onEditTitle={edit} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const input = await screen.findByRole('textbox', { name: 'Shared task title' });
    fireEvent.change(input, { target: { value: 'Updated shared presentation' } });
    const checkbox = screen.getAllByRole('button', { name: 'Mark complete' })[1];
    expect(input).toHaveFocus();
    expect(fireEvent.pointerDown(checkbox, { pointerType: 'touch' })).toBe(false);
    expect(input).toHaveFocus();
    expect(order).toEqual([]);
    fireEvent.click(checkbox, { detail: 1 });
    await waitFor(() => expect(order).toEqual([
      ...(toggles ? ['toggle'] : []),
      ...(keepFocus ? [] : ['blur']),
    ]));
    expect(edit).toHaveBeenCalledTimes(keepFocus ? 0 : 1);
    expect(toggle).toHaveBeenCalledTimes(toggles ? 1 : 0);
    if (toggles) expect(toggle).toHaveBeenCalledWith(otherRow, true);
    if (keepFocus) expect(input).toHaveFocus();
    else expect(input).not.toHaveFocus();
  });

  it('retains a shared title editor and completes another shared task without a synthesized click', async () => {
    const otherRow = { ...row, id: 'shr_other', taskId: 'task_other', title: 'Another shared task' };
    const toggle = vi.fn();
    const edit = vi.fn(async () => {});
    render(
      <div
        data-task-checkbox-preferences-scope="true"
        data-allow-task-checkboxes-while-adding="true"
        data-keep-task-input-focused-on-checkbox="true"
      >
        <SharedTaskRows {...baseProps} items={[row, otherRow]}
          onSetCompleted={toggle} onEditTitle={edit} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const input = await screen.findByRole('textbox', { name: 'Shared task title' });
    fireEvent.change(input, { target: { value: 'Unsaved shared title' } });
    input.focus(); // A cross-row checkbox gesture begins while the editor is active.
    expect(input).toHaveFocus();
    const checkbox = screen.getAllByRole('button', { name: 'Mark complete' })[1];
    fireEvent.pointerDown(checkbox, {
      pointerType: 'touch', pointerId: 33, button: 0, isPrimary: true,
      clientX: 15, clientY: 15,
    });
    input.blur();
    expect(edit).not.toHaveBeenCalled();
    fireEvent.pointerUp(checkbox, {
      pointerType: 'touch', pointerId: 33, clientX: 15, clientY: 15,
    });
    expect(toggle).toHaveBeenCalledExactlyOnceWith(otherRow, true);
    expect(input).toHaveFocus();
    fireEvent.click(checkbox, { detail: 0 });
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(edit).not.toHaveBeenCalled();
  });


  it('does not blur a shared task editor after another deferred completion is superseded by its own checkbox', async () => {
    const other = { ...row, id: 'shr_later', taskId: 'task_later', title: 'Other shared task' };
    const toggle = vi.fn();
    let resolveOther: () => void = () => {};
    toggle.mockImplementation((item: SharedTaskItem) => item.id === other.id
      ? new Promise<void>(resolve => { resolveOther = resolve; }) : undefined);
    const edit = vi.fn(async () => {});
    render(
      <div data-task-checkbox-preferences-scope="true"
        data-allow-task-checkboxes-while-adding="true"
        data-keep-task-input-focused-on-checkbox="false">
        <SharedTaskRows {...baseProps} items={[row, other]}
          onSetCompleted={toggle} onEditTitle={edit} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const input = await screen.findByRole('textbox', { name: 'Shared task title' });
    input.focus();
    const [ownCheckbox, otherCheckbox] = screen.getAllByRole('button', { name: 'Mark complete' });
    fireEvent.pointerDown(otherCheckbox, { pointerType: 'touch', button: 0 });
    fireEvent.click(otherCheckbox, { detail: 1 });
    expect(input).toHaveFocus();
    fireEvent.pointerDown(ownCheckbox, { pointerType: 'touch', button: 0 });
    fireEvent.click(ownCheckbox, { detail: 1 });
    expect(toggle).toHaveBeenCalledTimes(2);
    await act(async () => { resolveOther(); });
    expect(input).toHaveFocus();
    expect(edit).not.toHaveBeenCalled();
  });

  it('keeps the edited shared task checkbox actionable without applying other-task preferences', async () => {
    const toggle = vi.fn();
    const edit = vi.fn(async () => {});
    render(
      <div
        data-task-checkbox-preferences-scope="true"
        data-allow-task-checkboxes-while-adding="false"
        data-keep-task-input-focused-on-checkbox="false"
      >
        <SharedTaskRows {...baseProps} onSetCompleted={toggle} onEditTitle={edit} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const input = await screen.findByRole('textbox', { name: 'Shared task title' });
    fireEvent.change(input, { target: { value: 'Updated shared presentation' } });
    const checkbox = screen.getByRole('button', { name: 'Mark complete' });
    expect(fireEvent.pointerDown(checkbox, { pointerType: 'touch' })).toBe(false);
    fireEvent.click(checkbox, { detail: 1 });
    expect(toggle).toHaveBeenCalledExactlyOnceWith(row, true);
    expect(edit).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  it('uses the familiar inline title editor only when the owner granted permission', async () => {
    const edit = vi.fn(async () => {});
    const date = vi.fn(async () => {});
    render(<SharedTaskRows {...baseProps} onEditTitle={edit} onChangeDate={date} />);
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    expect(screen.getByRole('button', { name: /Change Date/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const input = await screen.findByRole('textbox', { name: 'Shared task title' });
    fireEvent.change(input, { target: { value: 'Updated by participant' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(edit).toHaveBeenCalledWith(row, 'Updated by participant'));
    expect(date).not.toHaveBeenCalled();
  });

  it('enforces owner-only editing without blocking an independent copy', () => {
    const disabledItem = { ...row, allowTitleEdit: false, allowDateEdit: false };
    render(<SharedTaskRows {...baseProps} items={[disabledItem]} onCopy={vi.fn(async () => {})} />);
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    expect(screen.getByRole('button', { name: 'Edit · owner only' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Duplicate' })).not.toBeDisabled();
  });

  it('keeps actions open when a category change relocates the originating row', async () => {
    const Fixture = () => {
      const [category, setCategory] = React.useState('');
      const [selected, setSelected] = React.useState<SharedTaskItem | null>(null);
      const handlers = {
        ...baseProps,
        categoryFor: () => category,
        onSelectItem: setSelected,
        onAssignCategory: async (_task: SharedTaskItem, next: string) => { setCategory(next); },
      };
      return <>
        {!category && <SharedTaskRows {...handlers} items={[row]} />}
        {category && <SharedTaskRows {...handlers} items={[row]} compact />}
        <SharedTaskRows {...handlers} items={[row]} actionsOnly selectedItem={selected} />
      </>;
    };
    render(<Fixture />);
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    fireEvent.click(screen.getByRole('combobox', { name: /^Assign shared task to my category:/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Personal planning' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeTruthy();
  });
  it('opens the shared date calendar without a second date-field tap', async () => {
    const editable = { ...row, allowDateEdit: true };
    const Fixture = () => {
      const [selected, setSelected] = React.useState<SharedTaskItem | null>(null);
      return <>
        <SharedTaskRows {...baseProps} items={[editable]} onSelectItem={setSelected} />
        <SharedTaskRows {...baseProps} items={[editable]} actionsOnly
          selectedItem={selected} onSelectItem={setSelected}
          onChangeDate={vi.fn(async () => {})} />
      </>;
    };
    render(<Fixture />);
    fireEvent.click(screen.getByRole('button', { name: 'Shared presentation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change Date' }));
    // One activation, same bottom sheet, no timer or second portal.
    expect(screen.getByRole('group', { name: 'Calendar dates' })).toBeTruthy();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
  it('handles pointer double-tap as edit, rather than opening actions', async () => {
    const edit = vi.fn(async () => {});
    render(<SharedTaskRows {...baseProps} onEditTitle={edit} />);
    vi.useFakeTimers();
    const button = screen.getByRole('button', { name: 'Shared presentation' });
    for (let i = 0; i < 2; i++) {
      fireEvent.pointerDown(button, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 });
      fireEvent.pointerUp(button, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 });
      await act(async () => { vi.advanceTimersByTime(50); });
    }
    expect(screen.getByRole('textbox', { name: 'Shared task title' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
