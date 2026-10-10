import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SharedTaskRows } from '../../src/components/home/views/SharedTaskRows';
import type { SharedTaskItem } from '../../src/lib/taskShareQueue';
vi.mock('../../src/hooks/useFriends', () => ({
  useOptionalFriendList: () => [{ friendId: 'owner_A', friendDisplayName: 'Alex' }],
}));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children }: { isOpen:boolean; children:React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));
const row: SharedTaskItem = {
  id:'shr_a', taskId:'task_a', ownerId:'owner_A', status:'accepted',
  grantEpoch:'grant_a', membershipRevision:'m1', completionRevision:'r1',
  completed:false, title:'Shared presentation', date:'2026-10-11',
  allowTitleEdit:true, allowDateEdit:false,
};
const categories = [{
  id:'cat_B', name:'Personal planning', color:'#ffffff', order:0,
  userId:'user_B', isDeleted:false, visibility:'private' as const, updatedAt:'now',
}];
describe('received shared task workspace', () => {
  it('assigns a private category and makes an independent copy', async () => {
    const assign = vi.fn(async () => {});
    const copy = vi.fn(async () => {});
    render(<SharedTaskRows items={[row]} categories={categories} categoryFor={() => ''}
      onAssignCategory={assign} onCopy={copy} onLeave={vi.fn()}
      pendingFor={() => undefined} onSetCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole('button',{name:'Manage shared task Shared presentation'}));
    fireEvent.change(screen.getByRole('combobox',{name:'Assign shared task to my category'}),
      {target:{value:'cat_B'}});
    await waitFor(()=>expect(assign).toHaveBeenCalledWith(row,'cat_B'));
    fireEvent.click(screen.getByRole('button',{name:'Duplicate as my own task'}));
    await waitFor(()=>expect(copy).toHaveBeenCalledWith(row,'cat_B'));
  });
  it('enforces per-field edit controls before dispatching actions', async () => {
    const edit = vi.fn(async () => {});
    const date = vi.fn(async () => {});
    render(<SharedTaskRows items={[row]} categories={categories}
      onEditTitle={edit} onChangeDate={date} onLeave={vi.fn()}
      pendingFor={() => undefined} onSetCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole('button',{name:'Manage shared task Shared presentation'}));
    expect(screen.getByRole('textbox',{name:'Edit shared title'})).not.toBeDisabled();
    expect(screen.getByLabelText('Change shared date')).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox',{name:'Edit shared title'}),
      {target:{value:'Updated by participant'}});
    fireEvent.click(screen.getByRole('button',{name:'Save shared title for everyone'}));
    await waitFor(()=>expect(edit).toHaveBeenCalledWith(row,'Updated by participant'));
    expect(date).not.toHaveBeenCalled();
  });
});
