import {afterEach,describe,expect,it,vi} from 'vitest';
import {
  buildScratchCurrentOriginRescueFile,
  stageSelectedScratchOwnerRescueFile,
  stageSelectedScratchOwnerRescueFileWithMedia,
} from '../../src/lib/e2ee/ownerCurrentOriginRescueBridge';
import {
  stageAuthenticatedScratchRescueFileV2,
  stageAuthenticatedScratchRescueFileV2WithVerifiedMedia,
} from '../../src/lib/e2ee/ownerRescueV2Staging';
import {OWNER_LOCAL_RESCUE_FILENAME} from '../../src/lib/e2ee/ownerLocalRescueBundle';
import {SCRATCH_OWNER_V2_PROJECT} from '../../src/lib/e2ee/ownerPrivateV2Contract';

const owner={projectId:SCRATCH_OWNER_V2_PROJECT,ownerId:'synthetic_root_cleanup'};
const keyId='k_'+'a'.repeat(32);
const gate={assertReady:vi.fn(async()=>{throw new Error('MFA pending');})};

/**
 * Capture ONLY the first per-invocation root copy (without touching the
 * source key or WebCrypto). This verifies explicit erasure on rejected
 * operations; successful crypto/IndexedDB paths remain in their own suites.
 */
async function expectFirstRootCopyErased(
  operation:(root:Uint8Array)=>Promise<unknown>,
):Promise<void>{
  const root=Uint8Array.from({length:32},(_,index)=>index+1);
  const original=Array.from(root);
  let captured:Uint8Array|null=null;
  Object.defineProperty(root,'slice',{value:()=>{
    const copy=Uint8Array.prototype.slice.call(root);
    captured=copy;
    return copy;
  }});
  await expect(operation(root)).rejects.toThrow();
  expect(captured).toBeInstanceOf(Uint8Array);
  expect(captured===null?null:Array.from(captured)).toEqual(Array(32).fill(0));
  // Clearing temporary invocation copies must NEVER clear the caller's root.
  expect(Array.from(root)).toEqual(original);
}
afterEach(()=>{vi.unstubAllGlobals();gate.assertReady.mockClear();});

describe('dormant encrypted rescue invocation-root copy erasure',()=>{
  it('clears the current-origin capture root if MFA gate rejects before reading',async()=>{
    vi.stubGlobal('indexedDB',{});
    vi.stubGlobal('localStorage',{});
    await expectFirstRootCopyErased(root=>
      buildScratchCurrentOriginRescueFile(root,owner,keyId,gate));
    expect(gate.assertReady).toHaveBeenCalledOnce();
  });
  it('clears the selected row-only rescue root if MFA gate rejects',async()=>{
    const file=new File(['synthetic ciphertext'],OWNER_LOCAL_RESCUE_FILENAME);
    await expectFirstRootCopyErased(root=>
      stageSelectedScratchOwnerRescueFile(root,owner,file,keyId,1,gate));
    expect(gate.assertReady).toHaveBeenCalledOnce();
  });
  it('clears the selected mixed photo/row rescue root if MFA gate rejects',async()=>{
    const file=new File(['synthetic ciphertext'],OWNER_LOCAL_RESCUE_FILENAME);
    await expectFirstRootCopyErased(root=>
      stageSelectedScratchOwnerRescueFileWithMedia(root,owner,file,keyId,1,gate));
    expect(gate.assertReady).toHaveBeenCalledOnce();
  });
  it('clears the direct row-only staging root if saved-file read fails',async()=>{
    const badFile={size:1,text:async()=>{throw new Error('unreadable file');}};
    await expectFirstRootCopyErased(root=>
      stageAuthenticatedScratchRescueFileV2(root,owner,badFile,keyId,1));
    expect(gate.assertReady).not.toHaveBeenCalled();
  });
  it('clears the direct mixed-staging root if saved-file read fails',async()=>{
    const badFile={size:1,text:async()=>{throw new Error('unreadable file');}};
    await expectFirstRootCopyErased(root=>
      stageAuthenticatedScratchRescueFileV2WithVerifiedMedia(root,owner,badFile,keyId,1));
    expect(gate.assertReady).not.toHaveBeenCalled();
  });
});
