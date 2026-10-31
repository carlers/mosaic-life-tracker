import { describe, expect, it, vi } from 'vitest';
import { createCommandTask } from '../../src/lib/taskCommandCreation';
import type { CategoryDocument } from '../../src/db/schema';

const school: CategoryDocument = {
  id:'school',userId:'owner',name:'School',color:'#ffffff',
  order:0,visibility:'private',isDeleted:false,updatedAt:'',
};
const foreign: CategoryDocument = {...school,id:'foreign',name:'Astronomy',userId:'friend'};
const task = { title:'review stars',categoryId:'',date:'2026-11-02',newCategoryName:'Astronomy' };
const setup = () => {
  const addTask = vi.fn(async () => 'task-1');
  const addCategory = vi.fn(async () => 'new-1');
  return { addTask,addCategory };
};
describe('Confirmed command creation', () => {
  it('creates a private owner category before creating its task', async () => {
    const {addTask,addCategory}=setup();
    await createCommandTask({uid:'owner',ownerValid:()=>true,loading:false,
      categories:[school,foreign],task,position:'bottom',addTask,addCategory});
    expect(addCategory).toHaveBeenCalledWith(expect.objectContaining({
      name:'Astronomy',visibility:'private',order:1,
    }));
    expect(addTask).toHaveBeenCalledWith(expect.objectContaining({
      title:'review stars',categoryId:'new-1',date:'2026-11-02',
    }),'bottom');
  });
  it('rejects a stale or foreign selected category without creating anything',async () => {
    const {addTask,addCategory}=setup();
    await expect(createCommandTask({uid:'owner',ownerValid:()=>true,loading:false,
      categories:[school,foreign],task:{title:'wrong',categoryId:'foreign',date:'2026-11-02'},
      position:'bottom',addTask,addCategory})).rejects.toThrow('no longer available');
    expect(addTask).not.toHaveBeenCalled();
    expect(addCategory).not.toHaveBeenCalled();
  });
  it('does not create the task after an account switch during category insertion',async () => {
    const {addTask,addCategory}=setup();
    let stillOwner=true;
    addCategory.mockImplementation(async () => {stillOwner=false;return 'new-1';});
    await expect(createCommandTask({uid:'owner',ownerValid:()=>stillOwner,loading:false,
      categories:[school],task,position:'top',addTask,addCategory})).rejects.toThrow('Account changed');
    expect(addTask).not.toHaveBeenCalled();
  });
  it('reuses an existing owned category with the same name and prevents duplicates',async () => {
    const {addTask,addCategory}=setup();
    await createCommandTask({uid:'owner',ownerValid:()=>true,loading:false,
      categories:[school,{...school,id:'astronomy',name:'Astronomy'}],task,
      position:'top',addTask,addCategory});
    expect(addCategory).not.toHaveBeenCalled();
    expect(addTask).toHaveBeenCalledWith(expect.objectContaining({categoryId:'astronomy'}),'top');
  });
});
