import {
  applyPwaUpdate,
  checkForPwaUpdate,
  dismissPwaInstall,
  dismissPwaUpdate,
  getPwaLifecycleSnapshot,
  initializePwaLifecycle,
  prefetchPwaUpdate,
  requestPwaInstall,
  resetPwaLifecycleForTests,
  subscribeToPwaLifecycle,
  type InstallPromptEvent,
} from '../../src/lib/pwaLifecycle';

interface FakeWindow extends EventTarget {
  location: { reload: ReturnType<typeof vi.fn> };
  navigator?: {
    serviceWorker?: {
      getRegistration?: ReturnType<typeof vi.fn>;
      controller?: ServiceWorker | null;
      ready?: Promise<ServiceWorkerRegistration>;
    };
  };
}

interface FakeRegisterOptions {
  onNeedRefresh?: () => void;
  onNeedReload?: () => void;
  onRegisteredSW?: (
    swUrl: string,
    registration: ServiceWorkerRegistration | undefined
  ) => void;
  onRegisterError?: (error: unknown) => void;
}

function fixture({
  callbackRegistration = true,
  browserRegistration = true,
  readyFallback = false,
}: {
  callbackRegistration?: boolean;
  browserRegistration?: boolean;
  readyFallback?: boolean;
} = {}) {
  const target = new EventTarget() as FakeWindow;
  target.location = { reload: vi.fn() };
  let options: FakeRegisterOptions = {};
  const update = vi.fn().mockResolvedValue(undefined);
  const registration = Object.assign(new EventTarget(), {
    waiting: null as ServiceWorker | null,
    installing: null as ServiceWorker | null,
    update: vi.fn().mockResolvedValue(undefined),
  }) as unknown as ServiceWorkerRegistration;
  const getRegistration = vi
    .fn()
    .mockResolvedValue(
      readyFallback ? undefined : browserRegistration ? registration : undefined
    );
  target.navigator = {
    serviceWorker: {
      getRegistration,
      controller:
        readyFallback && browserRegistration ? ({} as ServiceWorker) : null,
      ready: Promise.resolve(registration),
    },
  };
  const register = vi.fn((next: FakeRegisterOptions = {}) => {
    options = next;
    next.onRegisteredSW?.(
      '/sw.js',
      callbackRegistration ? registration : undefined
    );
    return update;
  });
  initializePwaLifecycle(target as unknown as Window, register);
  return {
    target,
    register,
    update,
    registration,
    getRegistration,
    get options() {
      return options;
    },
  };
}

describe('PWA lifecycle', () => {
  beforeEach(() => resetPwaLifecycleForTests());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Regression: §24.18 (controlled service worker marks shell offline-ready).
  it('marks the app shell ready when the page is already service-worker controlled', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() {
        return values.size;
      },
    });

    fixture({ readyFallback: true });

    expect(values.get('mosaic_offline_shell_ready')).toMatch(
      /^\d{4}-\d{2}-\d{2}T/
    );

  });

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

  it('checks the captured service-worker registration on demand with staged progress', async () => {
    const setup = fixture();
    const stages: string[] = [];

    await expect(
      checkForPwaUpdate((stage) => stages.push(stage))
    ).resolves.toBe('up-to-date');
    expect(stages).toEqual(['preparing', 'checking', 'up-to-date']);
    expect(setup.registration.update).toHaveBeenCalledOnce();
  });

  // Regression: §24.13 (manual update checks recover a valid browser registration).
  it('recovers the service-worker registration when the registration callback omits it', async () => {
    const setup = fixture({ callbackRegistration: false });

    await expect(checkForPwaUpdate()).resolves.toBe('up-to-date');
    expect(setup.getRegistration).toHaveBeenCalledOnce();
    expect(setup.registration.update).toHaveBeenCalledOnce();
  });

  // Regression: §24.13 (WebKit/Safari recovery uses standard service-worker APIs).
  it('falls back to the active ready registration when direct lookup yields no registration', async () => {
    const setup = fixture({
      callbackRegistration: false,
      browserRegistration: true,
      readyFallback: true,
    });

    await expect(checkForPwaUpdate()).resolves.toBe('up-to-date');
    expect(setup.getRegistration).toHaveBeenCalledOnce();
    expect(setup.registration.update).toHaveBeenCalledOnce();
  });

  it('still reports unavailable when the browser has no matching service-worker registration', async () => {
    const setup = fixture({
      callbackRegistration: false,
      browserRegistration: false,
    });

    await expect(checkForPwaUpdate()).resolves.toBe('unavailable');
    expect(setup.getRegistration).toHaveBeenCalledOnce();
  });

  it('re-surfaces an already-waiting update without another network check', async () => {
    const setup = fixture();
    const stages: string[] = [];
    (setup.registration as unknown as { waiting: ServiceWorker | null }).waiting =
      {} as ServiceWorker;

    await expect(
      checkForPwaUpdate((stage) => stages.push(stage))
    ).resolves.toBe('update-available');
    expect(stages).toEqual(['preparing', 'ready']);
    expect(getPwaLifecycleSnapshot().updateAvailable).toBe(true);
    expect(setup.registration.update).not.toHaveBeenCalled();
  });

  // Regression: §24.13 (worker discovery reports meaningful update stages).
  it('reports update-found and downloading while the new worker installs', async () => {
    const setup = fixture();
    const stages: string[] = [];
    let workerState: ServiceWorkerState = 'installing';
    const worker = Object.assign(new EventTarget(), {
      get state() {
        return workerState;
      },
    }) as unknown as ServiceWorker;

    setup.registration.update = vi.fn().mockImplementation(async () => {
      Object.assign(setup.registration, { installing: worker });
      setup.registration.dispatchEvent(new Event('updatefound'));
      workerState = 'installed';
      Object.assign(setup.registration, {
        waiting: worker,
        installing: null,
      });
      worker.dispatchEvent(new Event('statechange'));
    });

    await expect(
      checkForPwaUpdate((stage) => stages.push(stage))
    ).resolves.toBe('update-available');
    expect(stages).toEqual([
      'preparing',
      'checking',
      'update-found',
      'downloading',
      'ready',
    ]);
  });

  it('joins an update that is already downloading without blocking or starting another check', async () => {
    const setup = fixture();
    const stages: string[] = [];
    const worker = Object.assign(new EventTarget(), {
      state: 'installing' as ServiceWorkerState,
    }) as unknown as ServiceWorker;
    Object.assign(setup.registration, { installing: worker });

    await expect(
      checkForPwaUpdate((stage) => stages.push(stage))
    ).resolves.toBe('update-in-progress');

    expect(stages).toEqual([
      'preparing',
      'update-found',
      'downloading',
      'background-download',
    ]);
    expect(setup.registration.update).not.toHaveBeenCalled();
  });

  it('keeps a slow install in progress instead of reporting the app as current', async () => {
    vi.useFakeTimers();
    const setup = fixture();
    const stages: string[] = [];
    const worker = Object.assign(new EventTarget(), {
      state: 'installing' as ServiceWorkerState,
    }) as unknown as ServiceWorker;
    Object.assign(setup.registration, { installing: worker });

    const checking = checkForPwaUpdate((stage) => stages.push(stage));
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(checking).resolves.toBe('update-in-progress');
    expect(stages).toEqual([
      'preparing',
      'update-found',
      'downloading',
      'background-download',
    ]);
    expect(setup.registration.update).not.toHaveBeenCalled();
  });

  it('starts a background update fetch without waiting for the full install', async () => {
    const setup = fixture();
    const worker = Object.assign(new EventTarget(), {
      state: 'installing' as ServiceWorkerState,
    }) as unknown as ServiceWorker;

    setup.registration.update = vi.fn().mockImplementation(async () => {
      Object.assign(setup.registration, { installing: worker });
    });

    await expect(prefetchPwaUpdate()).resolves.toBe('update-in-progress');
    expect(setup.registration.update).toHaveBeenCalledOnce();
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
