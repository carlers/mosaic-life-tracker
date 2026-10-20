import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SupabaseAuthProvider from '../../src/hooks/SupabaseAuthProvider';
import { useAuth } from '../../src/hooks/useAuth';

const mock = vi.hoisted(() => ({
  signIn: vi.fn(), signOut: vi.fn(), resync: vi.fn(), signUp: vi.fn(),
  getPhase: vi.fn(), scope: vi.fn(), verify: vi.fn(), renew: vi.fn(),
}));
vi.mock('../../src/lib/supabaseCoreAuth', () => ({
  createSupabaseCoreAuthCoordinator: () => ({
    ...mock, getReplicationStates: () => null, refreshAndRestart: vi.fn(),
  }),
}));
vi.mock('../../supabase-poc/candidateAuthSession', () => ({
  createCandidateAuthSession: () => ({
    signUp: mock.signUp, getExpiresAt: () => Date.now() + 3600_000,
    getVerifiedSession: mock.verify,
  }),
}));
vi.mock('../../src/lib/supabaseCoreAuthority', () => ({
  createSupabaseCoreAuthority: () => ({ guard: {}, resolveIdentity: vi.fn(), renew: mock.renew }),
}));
vi.mock('../../src/lib/accountWorkScope', () => ({ scopeAccountWork: mock.scope }));
vi.mock('../../src/lib/syncStatus', () => ({
  publishSyncStatus: vi.fn(), scopeSyncStatusToUser: vi.fn(),
}));
vi.mock('../../src/lib/appSync', () => ({ registerCoreSync: () => vi.fn() }));

function Consumer() {
  const auth = useAuth();
  return <>
    <span>{auth.user?.$id ?? 'signed-out'}</span>
    {auth.error && <p role="alert">{auth.error}</p>}
    <button onClick={() => void auth.login('disposable@example.org', 'synthetic password')}>Sign in</button>
    <button onClick={() => void auth.logout()}>Sign out</button>
  </>;
}
const config = {
  driver: 'supabase' as const, baseUrl: 'http://127.0.0.1:54321',
  publishableKey: 'sb_publishable_test',
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.getPhase.mockReturnValue('signed-out');
  mock.signIn.mockResolvedValue({ legacyUserId: 'canonical_owner', supabaseUserId: 'signed-owner' });
  mock.signOut.mockResolvedValue(true);
  mock.verify.mockResolvedValue({ userId: 'signed-owner' });
  mock.renew.mockResolvedValue(undefined);
  mock.resync.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('Supabase app AuthContext lifecycle', () => {
  it('publishes the canonical owner only after guarded sign-in and clears it after stopped logout', async () => {
    let finish!: (value: unknown) => void;
    mock.signIn.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<SupabaseAuthProvider config={config}><Consumer /></SupabaseAuthProvider>);
    fireEvent.click(screen.getByText('Sign in'));
    expect(screen.getByText('signed-out')).toBeInTheDocument();
    finish({ legacyUserId: 'canonical_owner', supabaseUserId: 'signed-owner' });
    await screen.findByText('canonical_owner');
    expect(mock.scope).toHaveBeenCalledWith('canonical_owner');
    fireEvent.click(screen.getByText('Sign out'));
    await screen.findByText('signed-out');
    expect(mock.scope).toHaveBeenLastCalledWith(null);
  });

  it('does not expose an owner after server mapping/lease denial', async () => {
    mock.signIn.mockRejectedValue(new Error('server guard denied'));
    render(<SupabaseAuthProvider config={config}><Consumer /></SupabaseAuthProvider>);
    fireEvent.click(screen.getByText('Sign in'));
    await screen.findByRole('alert');
    expect(screen.getByText('signed-out')).toBeInTheDocument();
    expect(mock.scope).not.toHaveBeenCalledWith('canonical_owner');
  });

  it('cancels a late sign-in after the provider unmounts', async () => {
    let finish!: (value: unknown) => void;
    mock.signIn.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<SupabaseAuthProvider config={config}><Consumer /></SupabaseAuthProvider>);
    fireEvent.click(screen.getByText('Sign in'));
    view.unmount();
    finish({ legacyUserId: 'canonical_owner', supabaseUserId: 'signed-owner' });
    await waitFor(() => expect(mock.signOut).toHaveBeenCalledTimes(1));
    expect(mock.scope).not.toHaveBeenCalledWith('canonical_owner');
  });
});
