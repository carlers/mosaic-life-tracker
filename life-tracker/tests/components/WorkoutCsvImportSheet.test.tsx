import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutCsvImportSheet } from '../../src/components/modals/WorkoutCsvImportSheet';
import { importWorkoutRows } from '../../src/lib/workoutActivity';

vi.mock('../../src/lib/workoutActivity', () => ({
  importWorkoutRows: vi.fn().mockResolvedValue({ inserted: 3, alreadyPresent: 0, attempted: 3 }),
}));
vi.mock('../../src/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: [{
      id:'cat_workout', userId:'preview_owner', name:'Workout',
      color:'#FFBE0B',order:0,visibility:'private',isDeleted:false,
    }, { id:'cat_walk', userId:'preview_owner', name:'Walking', color:'#22AA88', order:1, visibility:'private', isDeleted:false }],
    isLoading:false,
    addCategory:vi.fn().mockResolvedValue('cat_new'),
  }),
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting:() => '',
    setSetting:vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'preview_owner' } }),
}));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({
    isOpen, title, children, onClose,
  }: { isOpen: boolean; title: string; children: React.ReactNode; onClose: () => void }) =>
    isOpen ? <div role="dialog" aria-label={title}>{children}<button onClick={onClose}>Dismiss {title}</button></div> : null,
}));
vi.mock('../../src/components/ui/MosaicSelect', () => ({
  MosaicSelect: ({
    value, label, onChange, options,
  }: {
    value: string;
    label: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>,
}));

const DATA = 'Completed At,Activity Type,Name,Distance Meters,Elapsed Time In Seconds\n' +
  '2026-11-18T07:30:00+08:00,Run,Morning Run,5000,1740';

describe('WorkoutCsvImportSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers a local sample preview without ever saving or fetching provider data', () => {
    render(<WorkoutCsvImportSheet isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Import workouts' })).toBeInTheDocument();
    expect(screen.getByText('CSV preview stays on this device')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load fictional sample' }));
    expect(screen.getByRole('status', { name: '' }).textContent).toBeDefined();
    expect(screen.getByText(/4 rows · 3 valid · 1 duplicates · 0 invalid/)).toBeInTheDocument();
    expect(screen.getByText('Morning run, easy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save 3 workouts to Workout/ })).toBeEnabled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('saves the fictional sample only after confirming its recommended category', async () => {
    render(<WorkoutCsvImportSheet isOpen onClose={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Load fictional sample'}));
    expect(screen.getByLabelText('Workout category')).toHaveValue('cat_workout');
    fireEvent.click(screen.getByRole('button',{name:/Save 3 workouts to Workout/}));
    await waitFor(() => expect(importWorkoutRows).toHaveBeenCalledWith(
      'preview_owner',expect.any(Array),'synthetic','cat_workout',new Map()
    ));
  });
  it('previews a user-selected CSV locally without submitting any records', async () => {
    render(<WorkoutCsvImportSheet isOpen onClose={vi.fn()} />);
    const file = new File([DATA], 'workouts.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(DATA) });
    fireEvent.change(screen.getByLabelText('Select workout CSV file'), {
      target: { files: [file] },
    });
    await waitFor(() => expect(screen.getByText('Morning Run')).toBeInTheDocument());
    expect(screen.getByText(/1 rows · 1 valid · 0 duplicates · 0 invalid/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save 1 workouts to Workout/ })).toBeDisabled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('requests mapping for headerless files and never invents a date or pace', async () => {
    render(<WorkoutCsvImportSheet isOpen onClose={vi.fn()} />);
    const file = new File([''], 'headerless.csv');
    Object.defineProperty(file, 'text', { value: () => Promise.resolve('2026-11-20,Run,Local run,1000,500') });
    fireEvent.change(screen.getByLabelText('Select workout CSV file'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/No recognizable column headings/)).toBeInTheDocument());
    expect(screen.queryByText('Local run')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Workout completed at'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Activity type'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Workout name'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Distance (meters)'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Elapsed duration (seconds)'), { target: { value: '4' } });
    expect(screen.getByText('Local run')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save 1 workouts to Workout/ })).toBeDisabled();
  });
  it('opens a history-style draft, stages title and category without saving, then imports the original rows with edits', async () => {
    render(<WorkoutCsvImportSheet isOpen onClose={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Load fictional sample'}));
    fireEvent.click(screen.getByRole('button',{name:'Open workout Morning run, easy'}));
    const detail = within(screen.getByRole('dialog',{name:'Review workout'}));
    expect(detail.getByRole('heading',{name:'Morning run, easy'})).toBeInTheDocument();
    expect(detail.getByText('5.00')).toBeInTheDocument();
    expect(detail.getByText('5:48/km')).toBeInTheDocument();
    fireEvent.change(detail.getByLabelText('Title'),{target:{value:'Edited morning run'}});
    fireEvent.change(detail.getByLabelText('Imported workout category'),{target:{value:'cat_walk'}});
    fireEvent.click(detail.getByRole('button',{name:'Apply to preview'}));
    expect(importWorkoutRows).not.toHaveBeenCalled();
    expect(screen.getByRole('button',{name:'Open workout Edited morning run'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Open workout Edited morning run'}));
    const reopened = within(screen.getByRole('dialog',{name:'Review workout'}));
    expect(reopened.getByLabelText('Title')).toHaveValue('Edited morning run');
    expect(reopened.getByLabelText('Imported workout category')).toHaveValue('cat_walk');
    fireEvent.change(reopened.getByLabelText('Title'),{target:{value:'Discarded edit'}});
    fireEvent.click(reopened.getByRole('button',{name:'Dismiss Review workout'}));
    expect(screen.getByRole('button',{name:'Open workout Edited morning run'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Save 3 workouts to selected categories'}));
    await waitFor(() => expect(importWorkoutRows).toHaveBeenCalledWith(
      'preview_owner',expect.arrayContaining([expect.objectContaining({line:2,title:'Morning run, easy'})]),
      'synthetic','cat_workout',new Map([[2,{title:'Edited morning run',categoryId:'cat_walk'}]])
    ));
  });

  it('allows inspection of duplicates without enabling edits or import of them', () => {
    render(<WorkoutCsvImportSheet isOpen onClose={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Load fictional sample'}));
    fireEvent.click(screen.getByRole('button',{name:'Open workout Evening run · Possible duplicate'}));
    const detail = within(screen.getByRole('dialog',{name:'Review workout'}));
    expect(detail.getByText(/Possible duplicate: identical stats/)).toBeInTheDocument();
    expect(detail.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(importWorkoutRows).not.toHaveBeenCalled();
  });

  it('keeps real Strava-source CSVs unsavable even after editing a draft', async () => {
    render(<WorkoutCsvImportSheet isOpen onClose={vi.fn()}/>);
    const file = new File([DATA], 'workouts.csv', {type:'text/csv'});
    Object.defineProperty(file,'text',{value:()=>Promise.resolve(DATA)});
    fireEvent.change(screen.getByLabelText('Select workout CSV file'),{target:{files:[file]}});
    fireEvent.click(await screen.findByRole('button',{name:'Open workout Morning Run'}));
    const detail = within(screen.getByRole('dialog',{name:'Review workout'}));
    fireEvent.change(detail.getByLabelText('Title'),{target:{value:'Renamed preview'}});
    fireEvent.click(detail.getByRole('button',{name:'Apply to preview'}));
    expect(screen.getByRole('button',{name:/Save 1 workouts to Workout/})).toBeDisabled();
    expect(importWorkoutRows).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

});
