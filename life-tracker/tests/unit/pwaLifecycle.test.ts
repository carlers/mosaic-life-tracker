import {
  applyPwaUpdate,
  dismissPwaInstall,
  dismissPwaUpdate,
  getPwaLifecycleSnapshot,
  initializePwaLifecycle,
  requestPwaInstall,
  resetPwaLifecycleForTests,
  subscribeToPwaLifecycle,
  type InstallPromptEvent,
} from '../../src/lib/pwaLifecycle';

interface FakeWindow extends EventTarget {
  location: { reload: ReturnType<typeof vi.fn> };
}

function fixture() {
  const target = new EventTarget() as FakeWindow;
  target.location = { reload: vi.fn() };
  let options: Record<string, (...args: never[]) => void> = {};
  const update = vi.fn().mockResolvedValue(undefined);
  const register = vi.fn((next: typeof options) => {
    options = next;
    return update;
  });
  initializePwaLifecycle(target as unknown as Window, register);
  return { target, register, update, get options() { return options; } };
}

describe('PWA lifecycle', () => {
  beforeEach(() => resetPwaLifecycleForTests());

  it('captures and resolves the browser install prompt', async () => {
    const { target } = fixture();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    }) as InstallPromptEvent;

    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(getPwaLifecycleSnapshot().installAvailable).toBe(true);
    await expect(requestPwaInstall()).resolves.toBe('accepted');
    expect(prompt).toHaveBeenCalledOnce();
    expect(getPwaLifecycleSnapshot().installAvailable).toBe(false);
  });

  it('publishes explicit update availability and applies only on request', async () => {
    const setup = fixture();
    const listener = vi.fn();
    subscribeToPwaLifecycle(listener);

    setup.options.onNeedRefresh();
    expect(getPwaLifecycleSnapshot().updateAvailable).toBe(true);
    expect(setup.update).not.toHaveBeenCalled();
    await expect(applyPwaUpdate()).resolves.toBe(true);
    expect(setup.update).toHaveBeenCalledOnce();
    expect(getPwaLifecycleSnapshot().updateAvailable).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it('reloads only after the registered worker reports an approved takeover', () => {
    const setup = fixture();
    setup.options.onNeedReload();
    expect(setup.target.location.reload).toHaveBeenCalledOnce();
  });

  it('keeps the update prompt available when activation fails', async () => {
    const setup = fixture();
    setup.options.onNeedRefresh();
    setup.update.mockRejectedValueOnce(new Error('activation failed'));

    await expect(applyPwaUpdate()).rejects.toThrow('activation failed');
    expect(getPwaLifecycleSnapshot().updateAvailable).toBe(true);
  });

  it('dismisses install and update prompts without applying either action', () => {
    const setup = fixture();
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' }),
    }) as InstallPromptEvent;
    setup.target.dispatchEvent(event);
    setup.options.onNeedRefresh();

    dismissPwaInstall();
    dismissPwaUpdate();
    expect(getPwaLifecycleSnapshot()).toEqual({
      installAvailable: false,
      updateAvailable: false,
    });
    expect(setup.update).not.toHaveBeenCalled();
  });
});
