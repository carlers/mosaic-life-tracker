import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeCommandSheet } from '../../src/components/home/HomeCommandSheet';
import type { CategoryDocument } from '../../src/db/schema';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));
vi.mock('../../src/components/ui/MosaicSelect', () => ({
  MosaicSelect: ({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => <select aria-label={label} value={value}
    onChange={event => onChange(event.target.value)}>
    <option value="">Choose category</option>
    {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
  </select>,
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({ getSetting: () => false }),
}));

const categories: CategoryDocument[] = [
  { id: 'school', userId: 'owner', name: 'School', color: '#ffffff',
    order: 0, visibility: 'private', isDeleted: false, updatedAt: '' },
  { id: 'errands', userId: 'owner', name: 'Errands', color: '#ffffff',
    order: 1, visibility: 'private', isDeleted: false, updatedAt: '' },
  { id: 'foreign', userId: 'someone-else', name: 'Private', color: '#ffffff',
    order: 2, visibility: 'private', isDeleted: false, updatedAt: '' },
];

function open(props: Partial<React.ComponentProps<typeof HomeCommandSheet>> = {}) {
  const onCreate = vi.fn(async () => {});
  const onClose = vi.fn();
  render(<HomeCommandSheet isOpen onClose={onClose} onCreate={onCreate}
    ownerId="owner" categories={categories} isLoading={false} {...props} />);
  return { onCreate, onClose };
}

describe('Home command Preview confirmation and account safety', () => {
  it('does not create anything during parsing; creates only after explicit confirmation', async () => {
    const { onCreate } = open();
    fireEvent.change(screen.getByLabelText('Command'), {
      target: { value: 'add go to school to errands for tomorrow' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review command' }));
    expect(onCreate).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Task title') as HTMLInputElement).value).toBe('go to school');
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('errands');
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith({
      title: 'go to school', categoryId: 'errands', date: expect.any(String),
    }, 'bottom');
  });

  it('rejects bulk commands and does not expose the create action', () => {
    const { onCreate } = open();
    fireEvent.change(screen.getByLabelText('Command'), {
      target: { value: 'move all school tasks to backlogs' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review command' }));
    expect(screen.getByRole('status').textContent).toContain('not supported yet');
    expect(screen.queryByRole('button', { name: 'Create task' })).toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('requires explicit category and schedule for ambiguous commands; hides foreign categories', () => {
    const { onCreate } = open();
    fireEvent.change(screen.getByLabelText('Command'), {
      target: { value: 'add homework to School' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review command' }));
    expect((screen.getByLabelText('Task title') as HTMLInputElement).value).toBe('homework');
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('school');
    expect(screen.queryByRole('option', { name: 'Private' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create task' }).hasAttribute('disabled')).toBe(true);
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Create task' })).toHaveProperty('disabled', true);
  });

  it('honors category ownership change by resetting the review state', () => {
    const { rerender } = render(<HomeCommandSheet isOpen onClose={() => {}}
      ownerId="owner" categories={categories} isLoading={false} onCreate={async () => {}} />);
    fireEvent.change(screen.getByLabelText('Command'), {
      target: { value: 'add study to School tomorrow' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review command' }));
    expect(screen.queryByLabelText('Task title')).not.toBeNull();
    rerender(<HomeCommandSheet isOpen onClose={() => {}}
      ownerId="other" categories={categories} isLoading={false} onCreate={async () => {}} />);
    expect(screen.queryByLabelText('Task title')).toBeNull();
  });
});


describe('Partial and new-category review', () => {
  it('prefills title/category without date and requires scheduling selection', async () => {
    const { onCreate } = open();
    fireEvent.change(screen.getByLabelText('Command'), { target: {value:'add do physics to school'} });
    fireEvent.click(screen.getByRole('button',{name:'Review command'}));
    expect((screen.getByLabelText('Task title') as HTMLInputElement).value).toBe('do physics');
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('school');
    expect((screen.getByRole('button',{name:'Create task'}) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Tomorrow'}));
    fireEvent.click(screen.getByRole('button',{name:'Create task'}));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0][0]).toMatchObject({title:'do physics',categoryId:'school'});
  });
  it('offers an explicit private category creation in confirmation payload',async () => {
    const {onCreate}=open();
    fireEvent.change(screen.getByLabelText('Command'), {target:{value:'add review galaxies to Astronomy tomorrow'}});
    fireEvent.click(screen.getByRole('button',{name:'Review command'}));
    expect((screen.getByLabelText('Task title') as HTMLInputElement).value).toBe('review galaxies');
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toContain('__command_create_category__');
    expect((screen.getByLabelText('New category name') as HTMLInputElement).value).toBe('Astronomy');
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Create task'}));
    await waitFor(()=>expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      title:'review galaxies', categoryId:'', newCategoryName:'Astronomy',
    });
  });
  it('never converts a bulk move into a category-creation form',() => {
    const {onCreate}=open();
    fireEvent.change(screen.getByLabelText('Command'), {target:{value:'move all tasks to School'}});
    fireEvent.click(screen.getByRole('button',{name:'Review command'}));
    expect(screen.queryByLabelText('New category name')).toBeNull();
    expect(onCreate).not.toHaveBeenCalled();
  });
});


describe('Browser speech consent and lifecycle', () => {
  it('never starts recognition automatically; requires consent and aborts on dismiss', () => {
    class FakeRecognition {
      static last: FakeRecognition | null = null;
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: {results: Array<Array<{transcript: string}>>}) => void) | null = null;
      onerror: ((event: {error: string}) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      abort = vi.fn();
      constructor() { FakeRecognition.last = this; }
    }
    vi.stubGlobal('SpeechRecognition', FakeRecognition);
    try {
      const { onCreate, onClose } = open();
      const consent = screen.getByRole('checkbox', {name:/Allow browser speech recognition/});
      const speak = screen.getByRole('button', {name:'Speak command'});
      expect(speak).toHaveProperty('disabled',true);
      expect(FakeRecognition.last).toBeNull();
      fireEvent.click(consent);
      fireEvent.click(speak);
      expect(FakeRecognition.last).not.toBeNull();
      expect(FakeRecognition.last!.start).toHaveBeenCalledOnce();
      expect(onCreate).not.toHaveBeenCalled();
      act(() => { FakeRecognition.last!.onresult?.({results: [[{transcript:'add do physics to school'}]]}); });
      expect((screen.getByLabelText('Command') as HTMLTextAreaElement).value).toBe('add do physics to school');
      fireEvent.click(screen.getByRole('button',{name:'Stop listening'}));
      expect(FakeRecognition.last!.abort).toHaveBeenCalledOnce();
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});


describe('Brave speech provider guidance', () => {
  it('warns when the Brave API is detected without claiming the microphone is denied', async () => {
    Object.defineProperty(navigator, 'brave', {
      configurable: true,
      value: { isBrave: async () => true },
    });
    const previous = Object.getOwnPropertyDescriptor(window, 'SpeechRecognition');
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: class { start() {} abort() {} },
    });
    try {
      const { onCreate } = open();
      expect((await screen.findByRole('note')).textContent).toMatch(/Brave may not have an available speech-to-text service/);
      expect(screen.getByRole('button', {name: 'Speak command'})).toHaveProperty('disabled', true);
      expect(onCreate).not.toHaveBeenCalled();
    } finally {
      delete (navigator as Navigator & { brave?: unknown }).brave;
      if (previous) Object.defineProperty(window, 'SpeechRecognition', previous);
      else delete (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
    }
  });
});


describe('local speech model consent', () => {
  it('never exposes a model download action without explicit opt-in', () => {
    const {onCreate}=open();
    const prepare=screen.getByRole('button', {name:'Prepare local voice'});
    expect(prepare).toHaveProperty('disabled',true);
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', {name:/Enable optional local model download and microphone recording/}));
    expect(prepare).toHaveProperty('disabled',false);
    expect(onCreate).not.toHaveBeenCalled();
  });
});
