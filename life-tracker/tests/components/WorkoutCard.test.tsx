import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkoutCard } from '../../src/components/home/views/WorkoutCard';
import type { ActivityDocument } from '../../src/db/schema';

const activity: ActivityDocument = {
  id:'act_test', userId:'owner', title:'Morning Run', sport:'Run',
  localDate:'2026-11-18', completedAt:'2026-11-18T07:30:00+08:00',
  distanceMeters:5000, elapsedSeconds:1740, source:'synthetic',
  fingerprint:'a'.repeat(64), categoryId:'cat_running',order:1,
  createdAt:'2026-11-18T07:30:00+08:00',
  updatedAt:'2026-11-18T07:30:00+08:00',isDeleted:false,
};

describe('compact-to-spotlight WorkoutCard', () => {
  it('expands to four labeled measurements without redundant View/edit copy', () => {
    const onOpen=vi.fn();
    render(<WorkoutCard activities={[activity]} categoryColor="#3B82F6" onOpen={onOpen}/>);
    const disclosure=screen.getByRole('button',{name:'Expand Morning Run'});
    expect(screen.getByRole('button',{name:'Expand Morning Run'})).toBeInTheDocument();
    expect(screen.queryByText('View / edit workout details')).not.toBeInTheDocument();
    fireEvent.click(disclosure);
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Avg pace')).toBeInTheDocument();
    expect(screen.getByText('Finished')).toBeInTheDocument();
    expect(screen.queryByText('View / edit workout details')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Edit workout Morning Run'}));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith('act_test');
    fireEvent.click(screen.getByRole('button',{name:'Collapse Morning Run'}));
    expect(screen.getByRole('button',{name:'Expand Morning Run'})).toBeInTheDocument();
  });
});
