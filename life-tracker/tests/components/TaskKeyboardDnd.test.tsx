import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DragDropProvider, useDraggable } from '@dnd-kit/react';
import { PointerSensor } from '@dnd-kit/dom';
import { TASK_REORDER_KEYBOARD_SENSOR } from '../../src/components/home/views/taskKeyboardSensor';

function DraggableTaskTitle({ onAction }: { onAction: (key: string) => void }) {
  const { ref, handleRef } = useDraggable({ id: 'task', type: 'task' });
  return <div ref={ref}>
    <button ref={handleRef} type="button" data-day-keyboard-target="task"
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onAction(event.key);
        }
      }}>Task title</button>
  </div>;
}

describe('Task keyboard and drag arbitration', () => {
  it('reserves Enter and Space for task-title actions, not dnd-kit lift', () => {
    const onDragStart = vi.fn();
    const onAction = vi.fn();
    render(<DragDropProvider sensors={[PointerSensor, TASK_REORDER_KEYBOARD_SENSOR]}
      onDragStart={onDragStart}>
      <DraggableTaskTitle onAction={onAction} />
    </DragDropProvider>);
    const title = screen.getByRole('button', { name: 'Task title' });
    title.focus();
    fireEvent.keyDown(title, { key: 'Enter', code: 'Enter' });
    fireEvent.keyDown(title, { key: ' ', code: 'Space' });
    expect(onAction).toHaveBeenCalledTimes(2);
    expect(onAction).toHaveBeenNthCalledWith(1, 'Enter');
    expect(onAction).toHaveBeenNthCalledWith(2, ' ');
    expect(onDragStart).not.toHaveBeenCalled();
    expect(title).toHaveFocus();
  });
});
