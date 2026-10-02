import { markOfflineShellReady } from './offlineReadiness';
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaLifecycleSnapshot {
  installAvailable: boolean;
  updateAvailable: boolean;
}

export type PwaUpdateCheckResult =
  | 'update-available'
  | 'update-in-progress'
  | 'up-to-date'
  | 'unavailable';

export type PwaUpdateCheckStage =
  | 'preparing'
  | 'checking'
  | 'update-found'
  | 'downloading'
  | 'background-download'
  | 'ready'
  | 'up-to-date'
  | 'unavailable';

export type PwaUpdateProgressListener = (stage: PwaUpdateCheckStage) => void;

type RegisterServiceWorker = (
  options?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onNeedReload?: () => void;
    onRegisteredSW?: (
      swUrl: string,
      registration: ServiceWorkerRegistration | undefined
    ) => void;
    onRegisterError?: (error: unknown) => void;
  }
) => (reloadPage?: boolean) => Promise<void>;

let snapshot: PwaLifecycleSnapshot = {
  installAvailable: false,
  updateAvailable: false,
};
let installPrompt: InstallPromptEvent | null = null;
let updateServiceWorker: (() => Promise<void>) | null = null;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
let serviceWorkerContainer: ServiceWorkerContainer | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function observeOfflineShellReady(
  registration: ServiceWorkerRegistration | null
): void {
  if (!registration) return;
  const candidate =
    registration.active ?? registration.waiting ?? registration.installing;
  if (!candidate) return;

  const markIfReady = () => {
    if (
      candidate.state === 'installed' ||
      candidate.state === 'activated'
    ) {
      markOfflineShellReady();
      candidate.removeEventListener?.('statechange', markIfReady);
    }
  };
  markIfReady();
  if (
    candidate.state !== 'installed' &&
    candidate.state !== 'activated' &&
    candidate.state !== 'redundant'
  ) {
    candidate.addEventListener?.('statechange', markIfReady);
  }
}

function publish(next: Partial<PwaLifecycleSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribeToPwaLifecycle(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaLifecycleSnapshot(): PwaLifecycleSnapshot {
  return snapshot;
}

export function initializePwaLifecycle(
  target: Window,
  register: RegisterServiceWorker
): void {
  if (initialized) return;
  initialized = true;
  serviceWorkerContainer = target.navigator?.serviceWorker ?? null;
  if (serviceWorkerContainer?.controller) {
    markOfflineShellReady();
  }

  target.addEventListener('beforeinstallprompt', ((event: InstallPromptEvent) => {
    event.preventDefault();
    installPrompt = event;
    publish({ installAvailable: true });
  }) as EventListener);
  target.addEventListener('appinstalled', () => {
    installPrompt = null;
    publish({ installAvailable: false });
  });

  updateServiceWorker = register({
    immediate: true,
    onNeedRefresh: () => publish({ updateAvailable: true }),
    onRegisteredSW: (_swUrl, registration) => {
      serviceWorkerRegistration = registration ?? null;
      observeOfflineShellReady(serviceWorkerRegistration);
    },
    // The generated worker only takes over after applyPwaUpdate sends the
    // explicit SKIP_WAITING request, so a reload here is always user-approved.
    onNeedReload: () => target.location.reload(),
    onRegisterError: (error) => {
      console.error('[PWA] Service-worker registration failed:', error);
    },
  });
}

export async function requestPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = installPrompt;
  if (!prompt) return 'unavailable';
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (installPrompt === prompt) {
    installPrompt = null;
    publish({ installAvailable: false });
  }
  return outcome;
}

export function dismissPwaInstall(): void {
  installPrompt = null;
  publish({ installAvailable: false });
}

async function resolveServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (serviceWorkerRegistration) return serviceWorkerRegistration;
  const container = serviceWorkerContainer;
  if (!container) return null;

  try {
    if (typeof container.getRegistration === 'function') {
      const registration = await container.getRegistration();
      if (registration) {
        serviceWorkerRegistration = registration;
        observeOfflineShellReady(registration);
        return registration;
      }
    }
  } catch (error) {
    console.warn('[PWA] Direct service-worker registration lookup failed:', error);
  }

  // Standards-only fallback for controlled pages. This covers browser-specific
  // registration timing/lookup differences (including WebKit/Safari) without
  // user-agent sniffing. `ready` should already be resolved for a controlled page.
  if (!container.controller) return null;
  try {
    const registration = await container.ready;
    serviceWorkerRegistration = registration;
    observeOfflineShellReady(registration);
    return registration;
  } catch (error) {
    console.warn('[PWA] Active service-worker registration lookup failed:', error);
    return null;
  }
}

const INSTALL_WAIT_BEFORE_BACKGROUND_MS = 30_000;

type InstallingWorkerResult =
  | 'installed'
  | 'activated'
  | 'redundant'
  | 'timeout';

function waitForInstallingWorker(
  worker: ServiceWorker
): Promise<InstallingWorkerResult> {
  if (
    worker.state === 'installed' ||
    worker.state === 'activated' ||
    worker.state === 'redundant'
  ) {
    return Promise.resolve(worker.state);
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeout = 0;
    const finish = (result: InstallingWorkerResult) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      worker.removeEventListener('statechange', handleStateChange);
      resolve(result);
    };
    const handleStateChange = () => {
      if (
        worker.state === 'installed' ||
        worker.state === 'activated' ||
        worker.state === 'redundant'
      ) {
        finish(worker.state);
      }
    };

    worker.addEventListener('statechange', handleStateChange);
    timeout = globalThis.setTimeout(
      () => finish('timeout'),
      INSTALL_WAIT_BEFORE_BACKGROUND_MS
    );
  });
}

function publishWaitingUpdate(
  report?: PwaUpdateProgressListener
): PwaUpdateCheckResult {
  publish({ updateAvailable: true });
  report?.('ready');
  return 'update-available';
}

async function waitForUpdateInstall(
  registration: ServiceWorkerRegistration,
  worker: ServiceWorker,
  report: PwaUpdateProgressListener
): Promise<PwaUpdateCheckResult | null> {
  report('update-found');
  report('downloading');
  const state = await waitForInstallingWorker(worker);

  if (state === 'redundant') {
    throw new Error('The downloaded service worker became redundant before installation completed.');
  }

  if (registration.waiting || snapshot.updateAvailable) {
    return publishWaitingUpdate(report);
  }

  if (state === 'timeout') {
    report('background-download');
    return 'update-in-progress';
  }

  return null;
}

export async function checkForPwaUpdate(
  onProgress?: PwaUpdateProgressListener
): Promise<PwaUpdateCheckResult> {
  const report = (stage: PwaUpdateCheckStage) => onProgress?.(stage);
  report('preparing');

  const registration = await resolveServiceWorkerRegistration();
  if (!registration) {
    report('unavailable');
    return 'unavailable';
  }

  if (registration.waiting) {
    return publishWaitingUpdate(report);
  }

  if (registration.installing) {
    report('update-found');
    report('downloading');
    report('background-download');
    return 'update-in-progress';
  }

  report('checking');
  let updateFound = false;
  const handleUpdateFound = () => {
    updateFound = true;
    report('update-found');
    if (registration.installing) {
      report('downloading');
    }
  };
  registration.addEventListener?.('updatefound', handleUpdateFound);

  try {
    await registration.update();

    if (registration.waiting || snapshot.updateAvailable) {
      return publishWaitingUpdate(report);
    }

    if (registration.installing) {
      const result = await waitForUpdateInstall(
        registration,
        registration.installing,
        report
      );
      if (result) return result;
    }

    if (updateFound) {
      throw new Error('An app update was found but did not finish installing.');
    }

    report('up-to-date');
    return 'up-to-date';
  } finally {
    registration.removeEventListener?.('updatefound', handleUpdateFound);
  }
}

export async function prefetchPwaUpdate(): Promise<PwaUpdateCheckResult> {
  const registration = await resolveServiceWorkerRegistration();
  if (!registration) return 'unavailable';

  if (registration.waiting) {
    return publishWaitingUpdate();
  }

  if (registration.installing) {
    return 'update-in-progress';
  }

  await registration.update();

  if (registration.waiting || snapshot.updateAvailable) {
    return publishWaitingUpdate();
  }

  return registration.installing ? 'update-in-progress' : 'up-to-date';
}

export async function applyPwaUpdate(): Promise<boolean> {
  if (!updateServiceWorker) return false;
  await updateServiceWorker();
  publish({ updateAvailable: false });
  return true;
}

export function dismissPwaUpdate(): void {
  publish({ updateAvailable: false });
}

export function resetPwaLifecycleForTests(): void {
  snapshot = { installAvailable: false, updateAvailable: false };
  installPrompt = null;
  updateServiceWorker = null;
  serviceWorkerRegistration = null;
  serviceWorkerContainer = null;
  initialized = false;
  listeners.clear();
}
