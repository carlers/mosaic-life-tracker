import { beforeEach,describe,it,expect,vi } from 'vitest';
const mock=vi.hoisted(()=>({send:vi.fn(),auth:vi.fn()}));
vi.mock('../../src/lib/appAction',()=>({sendAppAction:mock.send}));
vi.mock('../../src/lib/appwriteConfig',()=>({
  APPWRITE_PROJECT_ID:'6b00671500279e901846',
  APPWRITE_ENDPOINT:'https://129-221-244-67.sslip.io/v1',
}));
import {probeLegacyFunctionActions} from '../../src/lib/e2ee/legacyFunctionActionProbe';
const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_owner'};
const gate={assertReady:mock.auth};
const reject=(status:number,error:string)=>Object.assign(new Error('private server body'),{
  code:status,result:{error},
});
beforeEach(()=>{
  vi.clearAllMocks();
  mock.auth.mockResolvedValue(undefined);
  mock.send.mockRejectedValue(reject(409,'Legacy action unavailable during encryption'));
});
describe('synthetic old Function rejection: no mutating payload',()=>{
  it('sends no requests outside exact isolated Scratch project',async()=>{
    const v=await probeLegacyFunctionActions({...owner,projectId:'6ae9599c002ab812f9c3'},gate);
    expect(v.outcome).toBe('inconclusive');
    expect(mock.send).not.toHaveBeenCalled();
  });
  it('requires 409 with exact old-action fence body three times',async()=>{
    expect(await probeLegacyFunctionActions(owner,gate)).toEqual({
      outcome:'denied',checked:3,total:3,action:null,status:null,
    });
    expect(mock.auth).toHaveBeenCalledTimes(3);
    expect(mock.send.mock.calls.map(c=>c[0])).toEqual([
      {action:'create_owner_row',ownerId:'synthetic_owner'},
      {action:'compare_and_set_owner_row',ownerId:'synthetic_owner'},
      {action:'reserve_media_upload',ownerId:'synthetic_owner'},
    ]);
  });
  it('stops on any successful, ambiguous or fake 409 response',async()=>{
    mock.send.mockResolvedValueOnce({ok:true});
    expect(await probeLegacyFunctionActions(owner,gate)).toMatchObject({
      outcome:'unsafe',checked:0,action:'create_owner_row',
    });
    expect(mock.send).toHaveBeenCalledOnce();
    for(const e of [reject(409,'Account deletion in progress'),reject(400,'Bad Request'),reject(500,'Failed')]){
      vi.clearAllMocks();
      mock.auth.mockResolvedValue(undefined);
      mock.send.mockRejectedValueOnce(e);
      expect(await probeLegacyFunctionActions(owner,gate)).toMatchObject({
        outcome:'inconclusive',checked:0,action:'create_owner_row',status:e.code,
      });
    }
  });
  it('aborts when MFA/account-gate check fails',async()=>{
    mock.auth.mockRejectedValueOnce(new Error('MFA unavailable'));
    await expect(probeLegacyFunctionActions(owner,gate)).rejects.toThrow('MFA unavailable');
    expect(mock.send).not.toHaveBeenCalled();
  });
});
