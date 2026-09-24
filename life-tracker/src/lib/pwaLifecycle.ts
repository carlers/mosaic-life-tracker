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
  | 'up-to-date'
  | 'unavailable';

export type PwaUpdateCheckStage =
  | 'preparing'
  | 'checking'
  | 'update-found'
  | 'downloading'
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
    return registration;
  } catch (error) {
    console.warn('[PWA] Active service-worker registration lookup failed:', error);
    return null;
  }
}

function waitForInstallingWorker(
  worker: ServiceWorker
): Promise<void> {
  if (
    worker.state === 'installed' ||
    worker.state === 'activated' ||
    worker.state === 'redundant'
  ) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 15_000);
    const handleStateChange = () => {
      if (
        worker.state === 'installed' ||
        worker.state === 'activated' ||
        worker.state === 'redundant'
      ) {
        window.clearTimeout(timeout);
        worker.removeEventListener('statechange', handleStateChange);
        resolve();
      }
    };
    worker.addEventListener('statechange', handleStateChange);
  });
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
    publish({ updateAvailable: true });
    report('ready');
    return 'update-available';
  }

  report('checking');
  let updateFound = false;
  const handleUpdateFound = () => {
    updateFound = true;
    report('update-found');
    if (registration.installing) report('downloading');
  };
  registration.addEventListener?.('updatefound', handleUpdateFound);

  try {
    await registration.update();

    if (registration.installing) {
      if (!updateFound) report('update-found');
      report('downloading');
      await waitForInstallingWorker(registration.installing);
    }

    if (registration.waiting || snapshot.updateAvailable) {
      publish({ updateAvailable: true });
      report('ready');
      return 'update-available';
    }

    report('up-to-date');
    return 'up-to-date';
  } finally {
    registration.removeEventListener?.('updatefound', handleUpdateFound);
  }
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
