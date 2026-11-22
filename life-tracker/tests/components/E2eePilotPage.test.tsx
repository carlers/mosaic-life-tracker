import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mfaPending: false,
  root: new Uint8Array(32).fill(7),
  secret: new Uint8Array(32).fill(8),
  unlock: vi.fn(),
  remember: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  verifySaved: vi.fn(),
  wrap: vi.fn(),
}));

const envelope = {
  v: 1 as const, alg: 'A256GCM' as const,
  kid: 'k_' + 'a'.repeat(32), iv: 'AAAAAAAAAAAAAAAA',
  ct: 'A'.repeat(64),
};

vi.mock('../../src/lib/appwriteConfig', () => ({
  APPWRITE_PROJECT_ID: '6b00671500279e901846',
  APPWRITE_ENDPOINT: 'https://129-221-244-67.sslip.io/v1',
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { $id: 'synthetic_mfa_owner' },
    mfaPending: mocks.mfaPending,
    isLoading: false,
  }),
}));
vi.mock('../../src/lib/crypto/pilotDeviceStore', () => ({
  unlockRememberedPilotDevice: mocks.unlock,
  rememberPilotDevice: mocks.remember,
  listPendingPilotCiphertext: vi.fn().mockResolvedValue([]),
  savePendingPilotCiphertext: vi.fn(),
  clearPendingPilotCiphertext: vi.fn(),
}));
vi.mock('../../src/lib/crypto/pilotTransport', () => ({
  createPilotRoot: mocks.create,
  fetchPilotRoot: mocks.read,
  listPilotRows: vi.fn().mockResolvedValue({ rows: [], after: null }),
  putPilotRow: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/lib/crypto/pilotCrypto', () => ({
  generateAccountRoot: () => mocks.root,
  generateIndependentRecoverySecret: () => mocks.secret,
  generateKeyId: () => envelope.kid,
  formatIndependentRecoverySecret: () => 'saved-independent-key',
  verifySavedPilotRecoverySecret: mocks.verifySaved,
  wrapRootForRecovery: mocks.wrap,
  parseIndependentRecoverySecret: vi.fn(),
  unwrapRootFromRecovery: vi.fn(),
  decryptDiary: vi.fn(),
  encryptDiary: vi.fn(),
  generateOpaqueRowId: vi.fn(),
  generateRevision: vi.fn(),
}));

import E2eePilotPage from '../../src/pages/E2eePilotPage';

describe('isolated E2EE pilot account enrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mfaPending = false;
    mocks.root.fill(7);
    mocks.secret.fill(8);
    mocks.unlock.mockResolvedValue(null);
    mocks.remember.mockResolvedValue(undefined);
    mocks.create.mockResolvedValue(undefined);
    mocks.read.mockResolvedValue(envelope);
    mocks.wrap.mockResolvedValue(envelope);
    mocks.verifySaved.mockImplementation(async (_root, typedKey) => {
      if (typedKey !== 'saved-independent-key') throw new Error('Wrong recovery key');
    });
  });

  it('never creates the remote root until the separately saved key is re-entered and verified', async () => {
    render(<E2eePilotPage />);
    fireEvent.click(await screen.findByRole('button', {
      name: 'Initialize new synthetic-only account key',
    }));
    expect(screen.getByLabelText('One-time high-entropy recovery key'))
      .toHaveValue('saved-independent-key');
    const confirm = screen.getByLabelText('Confirm saved recovery key');
    const commit = screen.getByRole('button', { name: 'Verify and initialize encrypted pilot' });
    expect(commit).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', {
      name: 'I have saved the recovery key separately.',
    }));
    expect(commit).toBeDisabled();
    fireEvent.change(confirm, { target: { value: 'wrong-backup' } });
    fireEvent.click(commit);
    expect(await screen.findByRole('status')).toHaveTextContent('Recovery key verification failed');
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.remember).not.toHaveBeenCalled();

    fireEvent.change(confirm, { target: { value: 'saved-independent-key' } });
    fireEvent.click(commit);
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.verifySaved).toHaveBeenCalledWith(
      mocks.root, 'saved-independent-key',
      { projectId: '6b00671500279e901846', ownerId: 'synthetic_mfa_owner' },
      envelope,
    );
    expect(mocks.read).toHaveBeenCalledOnce();
    expect(mocks.remember).toHaveBeenCalledOnce();
    expect(await screen.findByText('Test device registered; encrypted root verified.'))
      .toBeInTheDocument();
    expect(screen.queryByLabelText('Confirm saved recovery key')).not.toBeInTheDocument();
    expect(mocks.secret.every(value => value === 0)).toBe(true);
  });

  it('wipes an uncommitted root and recovery secret when the account view unmounts', async () => {
    const view = render(<E2eePilotPage />);
    fireEvent.click(await screen.findByRole('button', {
      name: 'Initialize new synthetic-only account key',
    }));
    view.unmount();
    expect(mocks.root.every(value => value === 0)).toBe(true);
    expect(mocks.secret.every(value => value === 0)).toBe(true);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('wipes a delayed remembered root after the authenticated view has unmounted', async () => {
    let resolve: ((v: { root: Uint8Array; kid: string }) => void) | undefined;
    mocks.unlock.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const stale = new Uint8Array(32).fill(13);
    const view = render(<E2eePilotPage />);
    view.unmount();
    await act(async () => {
      resolve?.({ root: stale, kid: envelope.kid });
      await Promise.resolve();
    });
    expect(stale.every(value => value === 0)).toBe(true);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('refuses the pilot for an MFA-pending signed-in account', () => {
    mocks.mfaPending = true;
    render(<E2eePilotPage />);
    expect(screen.getByText('Complete normal sign-in and 2FA before unlocking this pilot.'))
      .toBeInTheDocument();
    expect(mocks.unlock).not.toHaveBeenCalled();
  });
});
