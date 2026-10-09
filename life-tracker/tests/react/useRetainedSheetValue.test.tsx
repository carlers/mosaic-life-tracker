import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRetainedSheetValue } from '../../src/hooks/useRetainedSheetValue';

type Entity = { id: string; label: string };
type Props = { entity: Entity | null; open: boolean };

describe('useRetainedSheetValue', () => {
  it('preserves closing data until exit, then accepts a different entity on reopen', () => {
    const first: Entity = { id: 'task_1', label: 'First task' };
    const second: Entity = { id: 'task_2', label: 'Second task' };
    const { result, rerender } = renderHook(
      ({ entity, open }: Props) => useRetainedSheetValue(entity, open),
      { initialProps: { entity: null as Entity | null, open: false } }
    );

    expect(result.current.value).toBeNull();
    rerender({ entity: first, open: true });
    expect(result.current.value).toEqual(first);

    // A feature's onClose may clear the entity and isOpen simultaneously.
    rerender({ entity: null, open: false });
    expect(result.current.value).toEqual(first);

    act(() => result.current.onExitComplete());
    expect(result.current.value).toBeNull();

    rerender({ entity: second, open: true });
    expect(result.current.value).toEqual(second);
    rerender({ entity: null, open: false });
    expect(result.current.value).toEqual(second);
    act(() => result.current.onExitComplete());
    expect(result.current.value).toBeNull();
  });

  it('keeps same-id updates live without rearming exit state on every render', () => {
    const first: Entity = { id: 'task_1', label: 'Initial' };
    const updated: Entity = { id: 'task_1', label: 'Updated' };
    const { result, rerender } = renderHook(
      ({ entity, open }: Props) => useRetainedSheetValue(entity, open),
      { initialProps: { entity: first as Entity | null, open: true } }
    );
    expect(result.current.value).toEqual(first);
    rerender({ entity: updated, open: true });
    expect(result.current.value).toEqual(updated);
    rerender({ entity: null, open: false });
    // The opened record survives disappearance until the exit callback.
    expect(result.current.value?.id).toBe('task_1');
  });
});
