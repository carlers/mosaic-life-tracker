import { beforeEach, describe, expect, it, vi } from 'vitest';

const diagnostic = vi.hoisted(() => ({
  start: vi.fn(() => 'browser-record'),
  mark: vi.fn(),
  end: vi.fn(),
  progress: vi.fn(),
  visibilityChanged: vi.fn(),
}));

vi.mock('../../src/lib/pwaUpdateDiagnostics', () => ({
  pwaDiagnosticsEnabled: true,
  pwaDiagnostics: diagnostic,
}));

vi.mock('../../src/lib/offlineReadiness', () => ({
  markOfflineShellReady: vi.fn(),
}));

import { initializePwaLifecycle, resetPwaLifecycleForTests } from '../../src/lib/pwaLifecycle';

function registrationFor(worker: ServiceWorker) {
  return Object.assign(new EventTarget(), {
    installing: worker,
    waiting: null as ServiceWorker | null,
    active: null as ServiceWorker | null,
    update: vi.fn().mockResolvedValue(undefined),
  }) as unknown as ServiceWorkerRegistration;
}

describe('browser-initiated update diagnostic deduplication', () => {
  beforeEach(() => {
    resetPwaLifecycleForTests();
    vi.clearAllMocks();
  });

  it('records one browser update even when two registrations and repeated updatefound callbacks see the same worker', () => {
    const worker = Object.assign(new EventTarget(), { state: 'installing' }) as ServiceWorker;
    const registrationOne = registrationFor(worker);
    const registrationTwo = registrationFor(worker);
    const target = Object.assign(new EventTarget(), {
      location: { reload: vi.fn() },
      navigator: { serviceWorker: Object.assign(new EventTarget(), {
        controller: null,
        getRegistration: vi.fn().mockResolvedValue(registrationOne),
      }) },
    }) as unknown as Window;
    let onRegistered:
      | ((url: string, registration: ServiceWorkerRegistration | undefined) => void)
      | undefined;

    initializePwaLifecycle(target, ((options) => {
      onRegistered = options?.onRegisteredSW;
      options?.onRegisteredSW?.('/sw.js', registrationOne);
      return vi.fn().mockResolvedValue(undefined);
    }));

    // Both registrations refer to the same installing worker, and each emits
    // updatefound independently. There must be exactly one browser trace.
    onRegistered?.('/sw.js', registrationTwo);
    registrationOne.dispatchEvent(new Event('updatefound'));
    registrationTwo.dispatchEvent(new Event('updatefound'));

    expect(diagnostic.start).toHaveBeenCalledExactlyOnceWith('browser');
    expect(diagnostic.mark).toHaveBeenCalledExactlyOnceWith('browser-record', 'update-found');

    Object.assign(worker, { state: 'installed' });
    worker.dispatchEvent(new Event('statechange'));
    expect(diagnostic.end).toHaveBeenCalledExactlyOnceWith('browser-record', 'ready');
    resetPwaLifecycleForTests();
  });

  it('still observes separate browser worker installs independently', () => {
    const first = Object.assign(new EventTarget(), { state: 'installing' }) as ServiceWorker;
    const second = Object.assign(new EventTarget(), { state: 'installing' }) as ServiceWorker;
    const registration = registrationFor(first);
    const target = Object.assign(new EventTarget(), {
      location: { reload: vi.fn() },
      navigator: { serviceWorker: Object.assign(new EventTarget(), {
        controller: null,
        getRegistration: vi.fn().mockResolvedValue(registration),
      }) },
    }) as unknown as Window;

    initializePwaLifecycle(target, ((options) => {
      options?.onRegisteredSW?.('/sw.js', registration);
      return vi.fn().mockResolvedValue(undefined);
    }));

    Object.assign(first, { state: 'installed' });
    first.dispatchEvent(new Event('statechange'));
    Object.assign(registration, { installing: second });
    registration.dispatchEvent(new Event('updatefound'));
    expect(diagnostic.start).toHaveBeenCalledTimes(2);
    resetPwaLifecycleForTests();
  });
});
