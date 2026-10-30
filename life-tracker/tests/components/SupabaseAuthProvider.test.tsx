import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BehaviorSubject, Subject } from 'rxjs';
import SupabaseAuthProvider from '../../src/hooks/SupabaseAuthProvider';
import { useAuth } from '../../src/hooks/useAuth';
import { CandidateSignupInvitationRequiredError } from '../../supabase-poc/candidateAuthSession';
import { SupabasePersonalReleasePendingError } from '../../src/lib/supabasePersonalAuthority';

const mock = vi.hoisted(() => ({
  signIn: vi.fn(), signOut: vi.fn(), resync: vi.fn(), signUp: vi.fn(),
  getPhase: vi.fn(), scope: vi.fn(), verify: vi.fn(), renew: vi.fn(),
  getReplicationStates: vi.fn(), publishStatus: vi.fn(),
  refreshAndRestart: vi.fn(), expiresAt: vi.fn(),
  getPendingConflicts: vi.fn(), subscribeConflicts: vi.fn(),
  refreshConflict: vi.fn(), keepLocalConflict: vi.fn(),
  suspend: vi.fn(),
}));
vi.mock('../../src/lib/supabaseCoreAuth', () => ({
  createSupabaseCoreAuthCoordinator: () => ({
    ...mock,
  }),
}));
vi.mock('../../supabase-poc/candidateAuthSession', async importOriginal => ({
  ...await importOriginal<typeof import('../../supabase-poc/candidateAuthSession')>(),
  createCandidateAuthSession: () => ({
    signUp: mock.signUp, getExpiresAt: mock.expiresAt,
    getVerifiedSession: mock.verify,
  }),
}));
vi.mock('../../src/lib/supabaseCoreAuthority', () => ({
  createSupabaseCoreAuthority: () => ({ guard: {}, resolveIdentity: vi.fn(), renew: mock.renew }),
}));
vi.mock('../../src/lib/accountWorkScope', () => ({ scopeAccountWork: mock.scope }));
vi.mock('../../src/lib/syncStatus', () => ({
  publishSyncStatus: mock.publishStatus, scopeSyncStatusToUser: vi.fn(),
}));
vi.mock('../../src/lib/appSync', () => ({ registerCoreSync: () => vi.fn() }));

function Consumer() {
  const auth = useAuth();
  return <>
    <span>{auth.user?.$id ?? 'signed-out'}</span>
    {auth.error && <p role="alert">{auth.error}</p>}
    <button onClick={() => void auth.login('disposable@example.org', 'synthetic password')}>Sign in</button>
    <button onClick={() => void auth.signup('disposable@example.org', 'synthetic password', 'Test', 'test_user')}>Sign up</button>
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
  mock.getReplicationStates.mockReturnValue(null);
  mock.signIn.mockResolvedValue({ legacyUserId: 'canonical_owner', supabaseUserId: 'signed-owner' });
  mock.signOut.mockResolvedValue(true);
  mock.suspend.mockResolvedValue(undefined);
  mock.verify.mockResolvedValue({ userId: 'signed-owner' });
  mock.renew.mockResolvedValue(undefined);
  mock.resync.mockResolvedValue(undefined);
  mock.expiresAt.mockImplementation(() => Date.now() + 3600_000);
  mock.refreshAndRestart.mockResolvedValue(undefined);
  mock.getPendingConflicts.mockReturnValue({ tasks: [], categories: [] });
  mock.subscribeConflicts.mockImplementation(listener => { listener(); return vi.fn(); });
});
afterEach(cleanup);

describe('Supabase app AuthContext lifecycle', () => {
  it('shows invite-only guidance only for typed signup refusal', async () => {
    mock.signUp.mockRejectedValueOnce(new CandidateSignupInvitationRequiredError());
    render(<SupabaseAuthProvider config={config}><Consumer /></SupabaseAuthProvider>);
    fireEvent.click(screen.getByText('Sign up'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This beta requires an invitation. Sign up using an invited email address.');
    expect(screen.getByText('signed-out')).toBeInTheDocument();
    expect(mock.scope).not.toHaveBeenCalledWith('canonical_owner');
  });

  it('shows an unreleased-personal warning without publishing any signed owner', async () => {
    mock.signIn.mockRejectedValueOnce(new SupabasePersonalReleasePendingError());
    render(<SupabaseAuthProvider config={config}><Consumer /></SupabaseAuthProvider>);
    fireEvent.click(screen.getByText('Sign in'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Personal sync is not released on this Scratch Preview.');
    expect(screen.getByText('signed-out')).toBeInTheDocument();
    expect(mock.scope).not.toHaveBeenCalledWith('canonical_owner');
  });

  it('never displays untrusted signup exception text or account identifiers', async () => {
    mock.signUp.mockRejectedValueOnce(new Error('private-password-and-owner-email'));
    render(<SupabaseAuthProvider config={config}><Consumer /></SupabaseAuthProvider>);
    fireEvent.click(screen.getByText('Sign up'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Account creation could not be completed.');
    expect(screen.queryByText(/private-password-and-owner-email/)).toBeNull();
  });

  it('stops a refreshed writer if the provider unmounts while recovery is in flight', async () => {
    const view = render(<SupabaseAuthProvider config={config}><Consumer /></SupabaseAuthProvider>);
    fireEvent.click(screen.getByText('Sign in'));
    await screen.findByText('canonical_owner');
    mock.expiresAt.mockReturnValue(Date.now() - 1);
    mock.getPhase.mockReturnValue('active');
    let finish!: () => void;
    mock.refreshAndRestart.mockImplementationOnce(() => {
      mock.getPhase.mockReturnValue('stopping');
      return new Promise<void>(resolve => { finish = resolve; });
    });
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(mock.refreshAndRestart).toHaveBeenCalledOnce());
    view.unmount();
    mock.getPhase.mockReturnValue('active');
    finish();
    await waitFor(() => expect(mock.suspend).toHaveBeenCalled());
    expect(mock.signOut).not.toHaveBeenCalled();
    expect(mock.resync).not.toHaveBeenCalled();
  });

  it('refreshes expired access before verification and retains the owner through a transient outage', async () => {
    render(<SupabaseAuthProvider config={config}><Consumer /></SupabaseAuthProvider>);
    fireEvent.click(screen.getByText('Sign in'));
    await screen.findByText('canonical_owner');
    mock.getPhase.mockReturnValue('active');
    mock.expiresAt.mockReturnValue(Date.now() - 1000);
    mock.refreshAndRestart.mockImplementationOnce(async () => {
      mock.getPhase.mockReturnValue('paused');
      throw Error('temporary network failure');
    });
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(mock.refreshAndRestart).toHaveBeenCalledOnce());
    expect(mock.verify).not.toHaveBeenCalled();
    expect(mock.signOut).not.toHaveBeenCalled();
    expect(screen.getByText('canonical_owner')).toBeInTheDocument();
    mock.refreshAndRestart.mockImplementationOnce(async () => {
      mock.getPhase.mockReturnValue('active');
      mock.expiresAt.mockReturnValue(Date.now() + 3600_000);
    });
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(mock.resync).toHaveBeenCalledOnce());
    expect(mock.refreshAndRestart.mock.invocationCallOrder.at(-1))
      .toBeLessThan(mock.verify.mock.invocationCallOrder[0]);
  });

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
    await waitFor(() => expect(mock.suspend).toHaveBeenCalled());
    expect(mock.signOut).not.toHaveBeenCalled();
    expect(mock.scope).not.toHaveBeenCalledWith('canonical_owner');
  });

  it('clears pending sync errors only after replication settles again', async () => {
    const state = {
      active$: new BehaviorSubject(false), error$: new Subject(),
      awaitInitialReplication: vi.fn().mockResolvedValue(undefined),
      awaitInSync: vi.fn().mockResolvedValue(undefined),
    };
    mock.getReplicationStates.mockReturnValue([state]);
    render(<SupabaseAuthProvider config={config}><Consumer /></SupabaseAuthProvider>);
    fireEvent.click(screen.getByText('Sign in'));
    await screen.findByText('canonical_owner');
    await waitFor(() => expect(mock.publishStatus).toHaveBeenCalledWith({
      lastSync: expect.any(String), errors: [],
    }));
    mock.publishStatus.mockClear();
    act(() => { state.error$.next(new Error('offline')); state.active$.next(true); });
    expect(mock.publishStatus).toHaveBeenCalledWith({
      errors: ['Core sync pending. Local changes are retained.'],
    });
    expect(mock.publishStatus).not.toHaveBeenCalledWith({ lastSync: expect.any(String), errors: [] });
    act(() => state.active$.next(false));
    await waitFor(() => expect(mock.publishStatus).toHaveBeenCalledWith({
      lastSync: expect.any(String), errors: [],
    }));
  });
});
