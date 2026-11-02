import { markOfflineShellReady } from './offlineReadiness';
import { pwaDiagnostics, pwaDiagnosticsEnabled } from './pwaUpdateDiagnostics';
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaAssetProgress {
  completed: number;
  total: number;
  completedBytes: number | null;
  totalBytes: number | null;
}

export interface PwaLifecycleSnapshot {
  installAvailable: boolean;
  updateAvailable: boolean;
  updateVersion: string | null;
  assetProgress: PwaAssetProgress | null;
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
  updateVersion: null,
  assetProgress: null,
};
let installPrompt: InstallPromptEvent | null = null;
let updateServiceWorker: (() => Promise<void>) | null = null;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
let serviceWorkerContainer: ServiceWorkerContainer | null = null;
let initialized = false;
let activeProgressWorker: ServiceWorker | null = null;
let queriedVersionWorker: ServiceWorker | null = null;
let observedVisibilityDocument: Document | null = null;
const observedDiagnosticWorkers = new WeakMap<ServiceWorker, Set<string>>();
const observedDiagnosticRegistrations = new WeakSet<ServiceWorkerRegistration>();
// Browser registration callbacks can present the same installing worker through
// distinct registration objects or repeated updatefound notifications. One
// browser-origin trace belongs to one worker, not to one callback.
const observedBrowserWorkers = new WeakSet<ServiceWorker>();
// A registration.update() promise may resolve before the browser emits
// updatefound. Keep the initiating app check marked for its entire lifetime,
// rather than relying on registrationUpdateInFlight alone for attribution.
let appUpdateChecksInFlight = 0;

function watchDiagnosticWorker(
  id: string | null,
  worker: ServiceWorker | null
) {
  if (!id || !worker) return;
  let traces = observedDiagnosticWorkers.get(worker);
  if (!traces) {
    traces = new Set();
    observedDiagnosticWorkers.set(worker, traces);
  }
  if (traces.has(id)) return;
  traces.add(id);
  const stop = () => {
    worker.removeEventListener('statechange', onStateChange);
    globalThis.clearTimeout(timeout);
    traces?.delete(id);
  };
  const onStateChange = () => {
    if (worker.state === 'installed' || worker.state === 'activated') {
      pwaDiagnostics.end(id, worker.state === 'installed' ? 'ready' : 'up-to-date');
      stop();
    } else if (worker.state === 'redundant') {
      pwaDiagnostics.end(id, 'redundant');
      stop();
    }
  };
  worker.addEventListener('statechange', onStateChange);
  // This timer is cleanup-only; browser lifecycle can throttle it.
  const timeout = globalThis.setTimeout(() => {
    pwaDiagnostics.end(id, 'timeout');
    stop();
  }, 3 * 60_000);
  onStateChange();
}

// The browser's own registration checks can start before the delayed Mosaic
// prefetch. Capture those separately rather than mislabeling them manual.
function observeBrowserUpdate(registration: ServiceWorkerRegistration) {
  if (!pwaDiagnosticsEnabled || observedDiagnosticRegistrations.has(registration)) return;
  observedDiagnosticRegistrations.add(registration);
  const onUpdateFound = () => {
    const worker = registration.installing;
    if (appUpdateChecksInFlight > 0 || registrationUpdateInFlight || !worker || observedBrowserWorkers.has(worker)) return;
    observedBrowserWorkers.add(worker);
    const id = pwaDiagnostics.start('browser');
    pwaDiagnostics.mark(id, 'update-found');
    watchDiagnosticWorker(id, worker);
  };
  registration.addEventListener('updatefound', onUpdateFound);
  if (registration.installing) onUpdateFound();
}

function receiveAssetProgress(event: MessageEvent): void {
  const data = event.data;
  if (data?.type === 'MOSAIC_PWA_VERSION') {
    // A worker can identify only itself. Never infer the destination from the
    // current page, URL, network cache or a different service-worker instance.
    const waiting = serviceWorkerRegistration?.waiting;
    if (waiting && event.source === waiting && queriedVersionWorker === waiting &&
        typeof data.version === 'string' && /^\\d+\\.\\d+\\.\\d+$/.test(data.version)) {
      publish({ updateVersion: data.version });
    }
    return;
  }
  if (!data || data.type !== 'MOSAIC_PWA_ASSET_PROGRESS') return;
  const worker = event.source;
  const registration = serviceWorkerRegistration;
  // A stale controller, unrelated tab, or older worker must not overwrite the
  // active update's progress. Browser-native installation has no such telemetry.
  if (!worker || !registration ||
      (registration.installing
        ? worker !== registration.installing
        : worker !== registration.waiting)) return;
  if (activeProgressWorker !== worker) {
    activeProgressWorker = worker as ServiceWorker;
    publish({ assetProgress: null });
  }

  const { completed, total, completedBytes, totalBytes } = data;
  if (!Number.isSafeInteger(completed) || !Number.isSafeInteger(total) ||
      total <= 0 || completed < 0 || completed > total) return;
  const bytesKnown = Number.isSafeInteger(completedBytes) &&
    Number.isSafeInteger(totalBytes) && totalBytes >= 0 &&
    completedBytes >= 0 && completedBytes <= totalBytes;
  if ((completedBytes !== null || totalBytes !== null) && !bytesKnown) return;
  const current = snapshot.assetProgress;
  if (current && (completed < current.completed ||
      (bytesKnown && current.completedBytes !== null &&
       completedBytes < current.completedBytes))) return;
  pwaDiagnostics.progress({ completed, total, completedBytes: bytesKnown ? completedBytes : null, totalBytes: bytesKnown ? totalBytes : null });
  publish({
    assetProgress: {
      completed,
      total,
      completedBytes: bytesKnown ? completedBytes : null,
      totalBytes: bytesKnown ? totalBytes : null,
    },
  });
}
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

function requestWaitingWorkerVersion(): void {
  const waiting = serviceWorkerRegistration?.waiting;
  if (!waiting || waiting === queriedVersionWorker) return;
  queriedVersionWorker = waiting;
  publish({ updateVersion: null });
  try {
    // Old installed workers don't implement this message; keep the generic
    // prompt when the exact destination version cannot be confirmed.
    waiting.postMessage({ type: 'MOSAIC_PWA_VERSION_REQUEST' });
  } catch {
    // Version labeling is advisory and must never prevent an update.
  }
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
  serviceWorkerContainer?.addEventListener?.('message', receiveAssetProgress);
  observedVisibilityDocument = target.document ?? null;
  observedVisibilityDocument?.addEventListener('visibilitychange', pwaDiagnostics.visibilityChanged);
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
    onNeedRefresh: () => {
      publish({ updateAvailable: true });
      requestWaitingWorkerVersion();
    },
    onRegisteredSW: (_swUrl, registration) => {
      serviceWorkerRegistration = registration ?? null;
      observeOfflineShellReady(serviceWorkerRegistration);
      if (serviceWorkerRegistration) observeBrowserUpdate(serviceWorkerRegistration);
      if (snapshot.updateAvailable) requestWaitingWorkerVersion();
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
        observeBrowserUpdate(registration);
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
    observeBrowserUpdate(registration);
    return registration;
  } catch (error) {
    console.warn('[PWA] Active service-worker registration lookup failed:', error);
    return null;
  }
}

// Browser-triggered and user-triggered checks share the same registration
// update call. Calling update() again cannot speed an installation in progress.
let registrationUpdateInFlight: Promise<void> | null = null;

function requestRegistrationUpdate(registration: ServiceWorkerRegistration): Promise<void> {
  if (registrationUpdateInFlight) return registrationUpdateInFlight;
  const pending = Promise.resolve().then(async () => { await registration.update(); });
  registrationUpdateInFlight = pending;
  void pending.then(
    () => { if (registrationUpdateInFlight === pending) registrationUpdateInFlight = null; },
    () => { if (registrationUpdateInFlight === pending) registrationUpdateInFlight = null; }
  );
  return pending;
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
    const timeout = globalThis.setTimeout(
      () => finish('timeout'),
      INSTALL_WAIT_BEFORE_BACKGROUND_MS
    );
  });
}

function publishWaitingUpdate(
  report?: PwaUpdateProgressListener
): PwaUpdateCheckResult {
  publish({ updateAvailable: true });
  requestWaitingWorkerVersion();
  report?.('ready');
  return 'update-available';
}

async function waitForUpdateInstall(
  registration: ServiceWorkerRegistration,
  worker: ServiceWorker,
  report: PwaUpdateProgressListener,
  alreadyReported = false
): Promise<PwaUpdateCheckResult | null> {
  if (!alreadyReported) {
    report('update-found');
    report('downloading');
  }
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
  appUpdateChecksInFlight += 1;
  try {
  const diagnostic = pwaDiagnostics.start('manual');
  const report = (stage: PwaUpdateCheckStage) => {
    onProgress?.(stage);
    if (stage === 'ready' || stage === 'up-to-date' || stage === 'unavailable') {
      pwaDiagnostics.end(diagnostic, stage);
    } else if (stage !== 'preparing') {
      pwaDiagnostics.mark(diagnostic, stage === 'background-download' ? 'joined-install' : stage);
    }
  };
  report('preparing');

  const registration = await resolveServiceWorkerRegistration();
  if (!registration) {
    publish({ assetProgress: null });
    report('unavailable');
    return 'unavailable';
  }

  // A manual recheck joins any installation already underway. Retain its
  // measured progress instead of visually restarting from 0%.
  if (!registration.installing && !registration.waiting) {
    publish({ assetProgress: null });
  }

  if (registration.waiting) {
    return publishWaitingUpdate(report);
  }

  if (registration.installing) {
    // Stay attached to the already-running installation rather than presenting
    // a final "in progress" result immediately. The existing 30-second bound
    // still lets the UI recover when the browser throttles background work.
    report('background-download');
    watchDiagnosticWorker(diagnostic, registration.installing);
    const result = await waitForUpdateInstall(registration, registration.installing, report);
    if (result) return result;
    report('up-to-date');
    return 'up-to-date';
  }

  report('checking');
  let updateFound = false;
  const handleUpdateFound = () => {
    if (updateFound) return;
    updateFound = true;
    report('update-found');
    watchDiagnosticWorker(diagnostic, registration.installing);
    if (registration.installing) {
      report('downloading');
    }
  };
  registration.addEventListener?.('updatefound', handleUpdateFound);

  try {
    await requestRegistrationUpdate(registration);

    if (registration.waiting || snapshot.updateAvailable) {
      return publishWaitingUpdate(report);
    }

    if (registration.installing) {
      watchDiagnosticWorker(diagnostic, registration.installing);
      const result = await waitForUpdateInstall(
        registration,
        registration.installing,
        report,
        updateFound
      );
      if (result) return result;
    }

    if (updateFound) {
      throw new Error('An app update was found but did not finish installing.');
    }

    report('up-to-date');
    return 'up-to-date';
  } catch (error) {
    pwaDiagnostics.fail(diagnostic, error);
    throw error;
  } finally {
    registration.removeEventListener?.('updatefound', handleUpdateFound);
  }
  } finally {
    appUpdateChecksInFlight -= 1;
  }
}

export async function prefetchPwaUpdate(): Promise<PwaUpdateCheckResult> {
  appUpdateChecksInFlight += 1;
  const diagnostic = pwaDiagnostics.start('background');
  try {
    const registration = await resolveServiceWorkerRegistration();
    if (!registration) {
      pwaDiagnostics.end(diagnostic, 'unavailable');
      return 'unavailable';
    }

    if (registration.waiting) {
      pwaDiagnostics.end(diagnostic, 'ready');
      return publishWaitingUpdate();
    }

    if (registration.installing) {
      pwaDiagnostics.mark(diagnostic, 'joined-install');
      watchDiagnosticWorker(diagnostic, registration.installing);
      return 'update-in-progress';
    }

    pwaDiagnostics.mark(diagnostic, 'checking');
    const onUpdateFound = () => {
      pwaDiagnostics.mark(diagnostic, 'update-found');
      watchDiagnosticWorker(diagnostic, registration.installing);
    };
    registration.addEventListener?.('updatefound', onUpdateFound);
    try {
      await requestRegistrationUpdate(registration);
    } finally {
      registration.removeEventListener?.('updatefound', onUpdateFound);
    }

    if (registration.waiting || snapshot.updateAvailable) {
      pwaDiagnostics.end(diagnostic, 'ready');
      return publishWaitingUpdate();
    }

    if (registration.installing) {
      watchDiagnosticWorker(diagnostic, registration.installing);
      return 'update-in-progress';
    }
    pwaDiagnostics.end(diagnostic, 'up-to-date');
    return 'up-to-date';
  } catch (error) {
    pwaDiagnostics.fail(diagnostic, error);
    throw error;
  } finally {
    appUpdateChecksInFlight -= 1;
  }
}

export async function applyPwaUpdate(): Promise<boolean> {
  if (!updateServiceWorker) return false;
  await updateServiceWorker();
  queriedVersionWorker = null;
  publish({ updateAvailable: false, updateVersion: null });
  return true;
}

export function dismissPwaUpdate(): void {
  queriedVersionWorker = null;
  publish({ updateAvailable: false, updateVersion: null });
}

export function resetPwaLifecycleForTests(): void {
  snapshot = { installAvailable: false, updateAvailable: false, updateVersion: null, assetProgress: null };
  activeProgressWorker = null;
  queriedVersionWorker = null;
  installPrompt = null;
  updateServiceWorker = null;
  serviceWorkerRegistration = null;
  serviceWorkerContainer?.removeEventListener?.('message', receiveAssetProgress);
  observedVisibilityDocument?.removeEventListener('visibilitychange', pwaDiagnostics.visibilityChanged);
  observedVisibilityDocument = null;
  serviceWorkerContainer = null;
  initialized = false;
  registrationUpdateInFlight = null;
  appUpdateChecksInFlight = 0;
  listeners.clear();
}
