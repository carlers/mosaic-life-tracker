import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  accountGet: vi.fn(), remoteRead: vi.fn(), unlock: vi.fn(),
  seal: vi.fn(), open: vi.fn(), upload: vi.fn(), download: vi.fn(),
  legacyReplay: vi.fn(),
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
  queueEncryptedOwnerIntent: vi.fn(), listEncryptedOwnerIntents: vi.fn(),
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
});

describe('M2 synthetic photo verification UI', () => {
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
