import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const f=vi.hoisted(()=>({owner:'owner',current:true,local:vi.fn(),portable:vi.fn(),
  lookup:vi.fn(),localData:{theme:'dark',profileImageId:'device-avatar'},
  portableData:{} as Record<string,unknown>}));
vi.mock('../../src/lib/coreBackendConfig',()=>({CORE_BACKEND:{driver:'supabase'}}));
vi.mock('../../src/lib/backendCapabilities',()=>({MOSAIC_FEATURE_PROFILE:'personal'}));
vi.mock('../../src/hooks/useAuth',()=>({useAuth:()=>({user:{$id:f.owner},isLocalOwnerCurrent:()=>f.current})}));
vi.mock('../../src/hooks/useRxCollection',()=>({useRxCollection:({collection}:{collection:string})=>({
  data:collection==='portableSettings'?f.portableData:f.localData,isLoading:false,
})}));
vi.mock('../../src/db/database',()=>({getDatabase:()=>({
  settings:{findOne:()=>({exec:f.lookup}),insert:f.local},
  portableSettings:{findOne:()=>({exec:f.lookup}),insert:f.portable},
})}));
import { useSettings } from '../../src/hooks/useSettings';
import { mergePersonalSettings } from '../../src/lib/personalSettings';
describe('portable preference app routing',()=>{
  beforeEach(()=>{vi.clearAllMocks();f.current=true;f.portableData={};f.lookup.mockResolvedValue(null);});
  it('writes private preferences to the isolated collection and keeps avatar/social rows local',async()=>{
    const {result}=renderHook(()=>useSettings());
    await act(async()=>{
      await result.current.setSetting('theme','light');
      await result.current.setSetting('profileImageId','avatar');
      await result.current.setSetting('friend_carousel_prefs',{});
    });
    expect(f.portable).toHaveBeenCalledWith(expect.objectContaining({key:'theme',value:'light',userId:'owner'}));
    expect(f.portable).toHaveBeenCalledOnce();
    expect(f.local).toHaveBeenCalledTimes(2);
  });
  it('shows synchronized values and does not resurrect device fallback after a portable tombstone',()=>{
    f.portableData={theme:undefined};
    const {result}=renderHook(()=>useSettings());
    expect(result.current.getSetting('theme','system')).toBe('system');
    expect(result.current.getSetting('profileImageId')).toBe('device-avatar');
    const row={id:'setting',userId:'owner',key:'theme',value:'dark',updatedAt:'2026-10-27T00:00:00Z',isDeleted:false};
    expect(mergePersonalSettings([row],[{...row,isDeleted:true}])).toEqual([{...row,isDeleted:true}]);
  });
  it('fences portable writes when the owner changes while a lookup is pending',async()=>{
    f.lookup.mockImplementation(async()=>{f.current=false;return null;});
    const {result}=renderHook(()=>useSettings());
    await expect(result.current.setSetting('theme','light')).rejects.toThrow('Account changed');
    expect(f.portable).not.toHaveBeenCalled();
  });
});
