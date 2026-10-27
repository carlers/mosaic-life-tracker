import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f=vi.hoisted(()=>({put:vi.fn(),compress:vi.fn(),decode:vi.fn(),close:vi.fn()}));
vi.mock('../../src/lib/coreBackendConfig',()=>({CORE_BACKEND:{driver:'supabase'}}));
vi.mock('../../src/lib/sdk',()=>({guardedAccount:{},guardedStorage:{}}));
vi.mock('../../src/lib/supabaseMedia',()=>({currentSupabaseMediaOwner:()=> 'owner',
  putSupabasePhoto:f.put,fetchSupabasePhoto:vi.fn(),deleteSupabasePhoto:vi.fn()}));
vi.mock('browser-image-compression',()=>({default:f.compress}));
import { ensureRestoredImage } from '../../src/lib/storage';
describe('Supabase original backup photo bytes',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();f.put.mockResolvedValue({fileId:'img_original',uploaded:true});
    f.decode.mockResolvedValue({width:2,height:2,close:f.close});
    vi.stubGlobal('createImageBitmap',f.decode);
  });
  afterEach(()=>vi.unstubAllGlobals());
  it('validates the WebP but sends original bytes without recompression',async()=>{
    const file=new File([new Uint8Array([1,2,3,4])],'original.webp',{type:'image/webp'});
    await ensureRestoredImage(file,'img_original','owner');
    expect(f.decode).toHaveBeenCalledWith(file);
    expect(f.close).toHaveBeenCalledOnce();
    expect(f.compress).not.toHaveBeenCalled();
    expect(f.put).toHaveBeenCalledWith(file,'img_original','owner',true);
  });
  it('rejects undecodable or oversized backup bytes before remote Storage',async()=>{
    f.decode.mockRejectedValueOnce(new Error('invalid WebP'));
    await expect(ensureRestoredImage(new File(['bad'],'bad.webp',{type:'image/webp'}),'img_bad','owner')).rejects.toThrow('invalid WebP');
    await expect(ensureRestoredImage(new File([new Uint8Array(5*1024*1024+1)],'large.webp',{type:'image/webp'}),'img_large','owner')).rejects.toThrow('limit');
    expect(f.put).not.toHaveBeenCalled();
  });
});
