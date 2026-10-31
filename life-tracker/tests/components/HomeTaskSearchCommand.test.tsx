import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HomeTaskSearch } from '../../src/components/home/HomeTaskSearch';

describe('Home command launcher', () => {
  it('exposes a separate accessible command action without invoking Search', () => {
    const onOpen = vi.fn();
    const onOpenCommand = vi.fn();
    render(<HomeTaskSearch
      isOpen={false} tasks={[]} categories={[]}
      onOpen={onOpen} onOpenCommand={onOpenCommand}
      onClose={() => {}} onSelectTask={() => {}}
      trailing={<span>Menu</span>}
    />);
    fireEvent.click(screen.getByRole('button', { name: 'Create task from command' }));
    expect(onOpenCommand).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Search tasks' })).toBeTruthy();
  });
});
