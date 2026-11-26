import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  accountGet: vi.fn(), remoteRead: vi.fn(), unlock: vi.fn(),
  seal: vi.fn(), open: vi.fn(), upload: vi.fn(), download: vi.fn(),
  legacyReplay: vi.fn(), legacyFunction: vi.fn(),
  migration: vi.fn(), recheck: vi.fn(), fixture: vi.fn(), intents: vi.fn(),
  pendingBuild: vi.fn(), pendingRead: vi.fn(),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'synthetic_owner' }, mfaPending: false, isLoading: false }),
}));
vi.mock('../../src/lib/appwriteConfig', () => ({
  APPWRITE_PROJECT_ID: '6b00671500279e901846',
  APPWRITE_ENDPOINT: 'https://129-221-244-67.sslip.io/v1',
}));
vi.mock('../../src/lib/appwrite', () => ({ account: { get: mocks.accountGet } }));
vi.mock('../../src/lib/e2ee/accountRootLifecycle', () => ({
  unlockRememberedAccountRoot: mocks.unlock,
  recoverAccountRoot: vi.fn(),
  InitialRootEnrollment: class {},
}));
vi.mock('../../src/lib/e2ee/rememberedRootIndexedDb', () => ({
  indexedDbRememberedRoots: {},
}));
vi.mock('../../src/lib/e2ee/ownerCiphertextTransport', () => ({
  createScratchOwnerRpc: () => ({ send: vi.fn() }),
  rootTransportFromRpc: () => ({ read: mocks.remoteRead }),
  OWNER_ONLY_COLLECTIONS: [
    'tasks', 'categories', 'diary', 'bucketList', 'bucketTaskLinks', 'settings',
  ],
}));
vi.mock('../../src/lib/e2ee/encryptedOwnerOutbox', () => ({
  queueEncryptedOwnerIntent: vi.fn(), listEncryptedOwnerIntents: mocks.intents,
  replayEncryptedOwnerIntents: vi.fn(),
}));
vi.mock('../../src/lib/e2ee/privateMediaCodec', () => ({
  sealPrivateMedia: mocks.seal, openPrivateMedia: mocks.open,
}));
vi.mock('../../src/lib/e2ee/ownerEncryptedMediaTransport', () => ({
  uploadEncryptedOwnerMedia: mocks.upload, downloadEncryptedOwnerMedia: mocks.download,
}));
vi.mock('../../src/lib/e2ee/m2SyntheticRecord', () => ({ syntheticDoc: vi.fn() }));
vi.mock('../../src/lib/e2ee/legacyDirectWriterProbe', () => ({ probeLegacyDirectWriters: mocks.legacyReplay }));
vi.mock('../../src/lib/e2ee/legacyFunctionActionProbe', () => ({ probeLegacyFunctionActions: mocks.legacyFunction }));
vi.mock('../../src/lib/e2ee/ownerShadowMigration', () => ({ shadowMigrateOwnerSnapshot: mocks.migration, verifyExistingOwnerSnapshot: mocks.recheck }));
vi.mock('../../src/lib/e2ee/m2SyntheticMigrationFixture', () => ({ buildSyntheticOwnerMigrationSource: mocks.fixture }));
vi.mock('../../src/lib/e2ee/localPendingRecoveryFile', () => ({
  buildLocalPendingRecoveryFile: mocks.pendingBuild,
  readLocalPendingRecoveryFile: mocks.pendingRead,
}));

import E2eeM2Page from '../../src/pages/E2eeM2Page';

const sample = () => new File([new Uint8Array([1, 2, 3])], 'synthetic.png', { type: 'image/png' });
async function openLab() {
  render(<E2eeM2Page />);
  await screen.findByRole('heading', { name: 'Encrypted synthetic media check' });
}
function select(file: File) {
  fireEvent.change(screen.getByLabelText('Synthetic photo'), { target: { files: [file] } });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.remoteRead.mockResolvedValue({ encryptedRoot: true });
  mocks.unlock.mockResolvedValue({
    root: new Uint8Array(32), keyId: 'k_' + 'a'.repeat(32), generation: 1,
  });
  mocks.accountGet.mockResolvedValue({ $id: 'synthetic_owner' });
  mocks.seal.mockImplementation(async (_root: unknown, _owner: unknown, _key: unknown, file: File) => ({
    manifest: { mediaId: 'm_' + 'b'.repeat(32) }, ciphertext: new Blob([await file.arrayBuffer()]),
  }));
  mocks.open.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
  mocks.upload.mockResolvedValue({ mediaId: 'm_' + 'b'.repeat(32) });
  mocks.download.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
  mocks.legacyReplay.mockResolvedValue({outcome:'denied',checked:7,total:7,target:null,status:null});
  mocks.legacyFunction.mockResolvedValue({outcome:'denied',checked:3,total:3,action:null,status:null});
  mocks.intents.mockResolvedValue([]);
  mocks.fixture.mockImplementation(owner => ({owner,completeAndFresh:true,collections:{}}));
  mocks.migration.mockResolvedValue({staged:6,verifiedExisting:6,verifiedNew:0,state:'shadow-ciphertext-only',sourceFingerprint:'private'});
  mocks.recheck.mockResolvedValue({verified:6,total:6,state:'existing-ciphertext-readonly'});
  mocks.pendingBuild.mockResolvedValue({filename:'mosaic-pending-recovery-v1.enc',file:new Blob(['ciphertext']),count:3});
  mocks.pendingRead.mockResolvedValue([{queue:'social',record:{id:'synthetic'}}]);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('M2 limited offline pending recovery file UI', () => {
  it('does not prepare or read a pending file on mount, and requires a separate download click', async () => {
    await openLab();
    expect(mocks.pendingBuild).not.toHaveBeenCalled();
    expect(mocks.pendingRead).not.toHaveBeenCalled();
    expect(screen.queryByRole('link',{name:/Download encrypted pending file/})).toBeNull();
    vi.stubGlobal('URL', Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(() => 'blob:synthetic'),
      revokeObjectURL: vi.fn(),
    }));
    fireEvent.click(screen.getByRole('button',{name:'Prepare locally encrypted pending queue file'}));
    await screen.findByRole('link',{name:'Download encrypted pending file (3 actions)'});
    expect(mocks.pendingBuild).toHaveBeenCalledOnce();
    expect(mocks.pendingBuild.mock.calls[0][0]).toEqual({
      projectId:'6b00671500279e901846',ownerId:'synthetic_owner',
    });
    const link=screen.getByRole('link',{name:'Download encrypted pending file (3 actions)'});
    expect(link.getAttribute('href')).toBe('blob:synthetic');
    expect(link.getAttribute('download')).toBe('mosaic-pending-recovery-v1.enc');
    expect(mocks.pendingRead).not.toHaveBeenCalled();
  });
  it('reads only the manually selected file and hides a stale PASS when selection changes', async () => {
    await openLab();
    const input=screen.getByLabelText('Select saved encrypted pending file');
    fireEvent.change(input,{target:{files:[new File(['encrypted'],'saved.enc',{type:'application/octet-stream'})]}});
    fireEvent.click(screen.getByRole('button',{name:'Verify selected encrypted pending file (read-only)'}));
    await screen.findByText(/Local encrypted file AEAD verification PASS: 1 queued actions/);
    expect(mocks.pendingRead).toHaveBeenCalledOnce();
    expect(mocks.pendingRead.mock.calls[0][0]).toEqual({
      projectId:'6b00671500279e901846',ownerId:'synthetic_owner',
    });
    fireEvent.change(input,{target:{files:[new File(['different'],'different.enc')]}});
    expect(screen.queryByText(/Local encrypted file AEAD verification PASS/)).toBeNull();
    mocks.pendingRead.mockRejectedValueOnce(new Error('private ciphertext'));
    fireEvent.click(screen.getByRole('button',{name:'Verify selected encrypted pending file (read-only)'}));
    await screen.findByText(/NOT VERIFIED: saved encrypted file was not authenticated/);
    expect(screen.queryByText('private ciphertext')).toBeNull();
  });
  it('fails closed with no downloadable link when local encryption is unavailable', async () => {
    await openLab();
    mocks.pendingBuild.mockRejectedValueOnce(new Error('private data / original queue'));
    fireEvent.click(screen.getByRole('button',{name:'Prepare locally encrypted pending queue file'}));
    await screen.findByText(/NOT VERIFIED: encrypted local pending queue file could not be prepared/);
    expect(screen.queryByRole('link',{name:/Download encrypted pending file/})).toBeNull();
    expect(screen.queryByText(/private data/)).toBeNull();
  });
});

describe('M2 synthetic photo verification UI', () => {
  it('read-only six-domain verification is opt-in, distinct and never starts migration',async()=>{
    await openLab();
    expect(mocks.recheck).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Recheck six encrypted records (read-only)'}));
    await screen.findByText(/Read-only verification PASS: 6\/6 previously stored synthetic records/);
    expect(mocks.recheck).toHaveBeenCalledOnce();
    expect(mocks.migration).not.toHaveBeenCalled();
    expect(mocks.recheck.mock.calls[0][0]).toMatchObject({
      owner:{projectId:'6b00671500279e901846',ownerId:'synthetic_owner'},
      completeAndFresh:true,
    });
  });
  it('removes a stale recheck PASS on missing/tampered ciphertext and fails closed',async()=>{
    await openLab();
    const button=screen.getByRole('button',{name:'Recheck six encrypted records (read-only)'});
    fireEvent.click(button);
    await screen.findByText(/Read-only verification PASS: 6\/6/);
    mocks.recheck.mockRejectedValueOnce(new Error('sensitive private record details'));
    fireEvent.click(button);
    await screen.findByText(/NOT VERIFIED: read-only ciphertext recheck failed/);
    expect(screen.queryByText(/Read-only verification PASS: 6\/6/)).toBeNull();
    expect(screen.queryByText(/sensitive private record details/)).toBeNull();
    expect(mocks.migration).not.toHaveBeenCalled();
  });

  it('runs six-domain synthetic shadow migration only on explicit authenticated click',async()=>{
    await openLab();
    expect(mocks.migration).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Verify six-domain synthetic migration'}));
    await screen.findByText(/Synthetic six-domain shadow migration verified: 0 newly encrypted, 6 previously stored/);
    expect(mocks.migration).toHaveBeenCalledOnce();
    expect(mocks.fixture).toHaveBeenCalledWith({
      projectId:'6b00671500279e901846',ownerId:'synthetic_owner',
    });
  });
  it('stops before any synthetic write when an encrypted owner intent is pending',async()=>{
    mocks.intents.mockResolvedValueOnce([{opId:'o_pending'}]);
    await openLab();
    fireEvent.click(screen.getByRole('button',{name:'Verify six-domain synthetic migration'}));
    await screen.findByText(/NOT VERIFIED: encrypted operations are pending/);
    expect(mocks.migration).not.toHaveBeenCalled();
  });
  it('never reports shadow migration success after interrupted authenticated readback',async()=>{
    mocks.migration.mockRejectedValueOnce(new Error('private remote ciphertext error'));
    await openLab();
    fireEvent.click(screen.getByRole('button',{name:'Verify six-domain synthetic migration'}));
    await screen.findByText(/NOT VERIFIED: synthetic shadow migration interrupted/);
    expect(screen.queryByText(/Synthetic six-domain shadow migration verified/)).toBeNull();
    expect(screen.queryByText(/private remote ciphertext error/)).toBeNull();
  });
  it('does not call old Function routes until explicit synthetic action',async()=>{
    await openLab();
    expect(mocks.legacyFunction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Test legacy Function write-fence'}));
    await screen.findByText(/Three legacy Function actions rejected/);
    expect(mocks.legacyFunction).toHaveBeenCalledOnce();
  });
  it('does not report old Function fence success for unexpected success',async()=>{
    mocks.legacyFunction.mockResolvedValueOnce({outcome:'unsafe',checked:0,total:3,action:'create_owner_row',status:null});
    await openLab();
    fireEvent.click(screen.getByRole('button',{name:'Test legacy Function write-fence'}));
    await screen.findByText(/UNSAFE: legacy Function action returned success/);
    expect(screen.queryByText(/Three legacy Function actions rejected/)).toBeNull();
  });
  it('does not trigger legacy writes on mount and reports exact 7/7 denial only after click',async()=>{
    await openLab();
    expect(mocks.legacyReplay).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Test legacy direct-create denial'}));
    await screen.findByText(/Seven synthetic direct-create requests denied/);
    expect(mocks.legacyReplay).toHaveBeenCalledOnce();
  });
  it('does not report a legacy denial pass after unexpected accepted write',async()=>{
    mocks.legacyReplay.mockResolvedValueOnce({outcome:'unsafe',checked:2,total:7,target:'diary',status:null});
    await openLab();
    fireEvent.click(screen.getByRole('button',{name:'Test legacy direct-create denial'}));
    await screen.findByText(/UNSAFE: a legacy direct-create request succeeded at diary/);
    expect(screen.queryByText(/Seven synthetic direct-create requests denied/)).toBeNull();
  });
  it('reports local AEAD separately and never mistakes it for server upload', async () => {
    await openLab();
    select(sample());
    fireEvent.click(screen.getByRole('button', { name: 'Verify local photo encryption' }));
    await screen.findByText(/Local photo encryption\/decryption verified/);
    expect(screen.queryByText(/Remote upload is NOT yet enabled/)).toBeNull();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it('runs the server upload/readback/download verification only on explicit remote action', async () => {
    await openLab();
    select(sample());
    fireEvent.click(screen.getByRole('button', { name: 'Upload and verify encrypted photo' }));
    await screen.findByText('Synthetic encrypted photo upload, server readback and local decryption verified.');
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.download).toHaveBeenCalledOnce();
    expect(mocks.upload.mock.calls[0][2]).toBe(mocks.seal.mock.results[0].value instanceof Promise
      ? await mocks.seal.mock.results[0].value : mocks.seal.mock.results[0].value);
  });

  it('replaces a stale local PASS with remote failure and retries the same ciphertext', async () => {
    await openLab();
    select(sample());
    fireEvent.click(screen.getByRole('button', { name: 'Verify local photo encryption' }));
    await screen.findByText(/Local photo encryption\/decryption verified/);
    mocks.upload.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Upload and verify encrypted photo' }));
    await screen.findByText(/Remote photo upload or readback did not complete/);
    expect(screen.queryByText(/Local photo encryption\/decryption verified/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Upload and verify encrypted photo' }));
    await screen.findByText('Synthetic encrypted photo upload, server readback and local decryption verified.');
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.upload.mock.calls[0][2]).toBe(mocks.upload.mock.calls[1][2]);
    expect(mocks.seal).toHaveBeenCalledTimes(2); // local-only check + once per remote file
  });

  it('clears past media result and ciphertext when another file is selected', async () => {
    await openLab();
    select(sample());
    fireEvent.click(screen.getByRole('button', { name: 'Upload and verify encrypted photo' }));
    await screen.findByText('Synthetic encrypted photo upload, server readback and local decryption verified.');
    select(new File([new Uint8Array([1, 2, 3])], 'second.png', { type: 'image/png' }));
    expect(screen.queryByText('Synthetic encrypted photo upload, server readback and local decryption verified.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Upload and verify encrypted photo' }));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(2));
    expect(mocks.seal).toHaveBeenCalledTimes(2);
    expect(mocks.upload.mock.calls[0][2]).not.toBe(mocks.upload.mock.calls[1][2]);
  });

  it('shows only safe failure phase and numeric HTTP status, not raw server data', async () => {
    await openLab();
    select(sample());
    mocks.upload.mockRejectedValueOnce(Object.assign(new Error('private response'),{
      phase:'upload',code:413,
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload and verify encrypted photo' }));
    await screen.findByText(/Stage: upload\. Result: HTTP 413/);
    expect(screen.queryByText(/private response/)).toBeNull();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it('reports authorization denial in the photo section without echoing private server errors', async () => {
    await openLab();
    select(sample());
    mocks.upload.mockRejectedValueOnce(Object.assign(new Error('secret server details'), { code: 403 }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload and verify encrypted photo' }));
    await screen.findByText(/Remote encrypted-photo access was denied/);
    expect(screen.queryByText('secret server details')).toBeNull();
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it('renders only allowlisted server-side Storage reasons without echoing sensitive details',async()=>{
    await openLab();
    select(sample());
    mocks.upload.mockRejectedValueOnce(Object.assign(new Error('private backend secret'),{
      phase:'upload',code:503,reason:'storage_write_forbidden',
    }));
    fireEvent.click(screen.getByRole('button',{name:'Upload and verify encrypted photo'}));
    await screen.findByText(/Stage: upload\. Result: HTTP 503\. Storage: storage_write_forbidden\./);
    expect(screen.queryByText(/private backend secret/)).toBeNull();
    mocks.upload.mockRejectedValueOnce(Object.assign(new Error('private backend secret'),{
      phase:'upload',code:503,reason:'private backend secret',
    }));
    fireEvent.click(screen.getByRole('button',{name:'Upload and verify encrypted photo'}));
    await screen.findByText(/Stage: upload\. Result: HTTP 503\./);
    expect(screen.queryByText(/Storage: private backend secret/)).toBeNull();
  });

});
