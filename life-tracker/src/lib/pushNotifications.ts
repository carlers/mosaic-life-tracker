import { getConnectivitySnapshot } from './connectivity';
import { sendAppAction } from './appAction';

const PUSH_STATE_DB = 'mosaic_push_state';
const PUSH_STATE_STORE = 'meta';
const ACTIVE_USER_KEY = 'active-user';

export type PushNotificationStatus =
  | 'checking'
  | 'unsupported'
  | 'install-required'
  | 'blocked'
  | 'unconfigured'
  | 'available'
  | 'enabled';

export interface PushNotificationState {
  status: PushNotificationStatus;
  enabled: boolean;
  label: string;
  /** null means the server preference has not been verified. */
  detailsEnabled: boolean | null;
}

interface PushConfig {
  enabled: boolean;
  publicKey: string;
}

let markerWrite: Promise<void> = Promise.resolve();

function openPushStateDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PUSH_STATE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PUSH_STATE_STORE)) {
        request.result.createObjectStore(PUSH_STATE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeActiveUser(userId: string | null): Promise<void> {
  try {
    const db = await openPushStateDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PUSH_STATE_STORE, 'readwrite');
      const store = tx.objectStore(PUSH_STATE_STORE);
      const request = userId
        ? store.put(userId, ACTIVE_USER_KEY)
        : store.delete(ACTIVE_USER_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[pushNotifications] active-user marker failed:', error);
  }
}

export function setPushActiveUser(userId: string | null): Promise<void> {
  markerWrite = markerWrite.then(() => writeActiveUser(userId));
  return markerWrite;
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const classicIos = /iPhone|iPad|iPod/i.test(ua);
  const ipadDesktopMode =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return classicIos || ipadDesktopMode;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigatorWithStandalone.standalone === true
  );
}

function supportsWebPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function state(
  status: PushNotificationStatus,
  label: string,
  enabled = false,
  detailsEnabled: boolean | null = null
): PushNotificationState {
  return { status, label, enabled, detailsEnabled };
}

function supportState(): PushNotificationState | null {
  if (!supportsWebPush()) {
    return state('unsupported', 'Not supported on this device');
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return state(
      'install-required',
      'Install Mosaic to your Home Screen first'
    );
  }
  if (Notification.permission === 'denied') {
    return state('blocked', 'Blocked in system or browser settings');
  }
  return null;
}

async function getLocalSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

async function getPushConfig(): Promise<PushConfig> {
  const result = await sendAppAction({ action: 'get_push_config' });
  return {
    enabled: result.enabled === true,
    publicKey:
      typeof result.publicKey === 'string' ? result.publicKey : '',
  };
}

function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh || '',
    auth: json.keys?.auth || '',
    expirationTime:
      subscription.expirationTime === null
        ? ''
        : String(subscription.expirationTime),
  };
}

async function registerSubscription(
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  await sendAppAction({
    action: 'register_push_subscription',
    expectedUserId: userId,
    ...subscriptionPayload(subscription),
  });
}

async function readPushDetails(userId: string, endpoint: string): Promise<boolean> {
  const result = await sendAppAction({
    action: 'get_push_details', expectedUserId: userId, endpoint,
  });
  return result.includeTaskDetails === true;
}

export async function setPushDetails(
  userId: string,
  includeTaskDetails: boolean
): Promise<PushNotificationState> {
  if (!userId || getConnectivitySnapshot().status !== 'online') {
    throw new Error('Push preferences require an online signed-in account');
  }
  const subscription = await getLocalSubscription();
  if (!subscription) throw new Error('Push is not enabled on this device');
  await sendAppAction({
    action: 'set_push_details', expectedUserId: userId,
    endpoint: subscription.endpoint, includeTaskDetails,
  });
  return getPushNotificationState(userId);
}

export async function reconcileExistingPushSubscription(
  userId: string
): Promise<boolean> {
  if (!userId || supportState()) return false;
  if (getConnectivitySnapshot().status !== 'online') return false;

  const subscription = await getLocalSubscription();
  if (!subscription) return false;

  const config = await getPushConfig();
  if (!config.enabled || !config.publicKey) return false;

  await registerSubscription(userId, subscription);
  return true;
}

export async function getPushNotificationState(
  userId = ''
): Promise<PushNotificationState> {
  const unsupported = supportState();
  if (unsupported) return unsupported;

  const subscription = await getLocalSubscription();
  if (subscription) {
    if (getConnectivitySnapshot().status === 'online' && userId) {
      try {
        const config = await getPushConfig();
        if (!config.enabled || !config.publicKey) {
          return state(
            'unconfigured',
            'Push delivery is not configured'
          );
        }
        await registerSubscription(userId, subscription);
      } catch (error) {
        console.warn(
          '[pushNotifications] subscription reconciliation failed:',
          error
        );
      }
    }
    let detailsEnabled: boolean | null = null;
    if (userId && getConnectivitySnapshot().status === 'online') {
      try {
        detailsEnabled = await readPushDetails(userId, subscription.endpoint);
      } catch (error) {
        console.warn('[pushNotifications] details check failed:', error);
      }
    }
    return state('enabled', 'Enabled on this device', true, detailsEnabled);
  }

  if (getConnectivitySnapshot().status !== 'online') {
    return state('available', 'Available when online');
  }

  try {
    const config = await getPushConfig();
    if (!config.enabled || !config.publicKey) {
      return state('unconfigured', 'Push delivery is not configured');
    }
  } catch {
    return state('available', 'Available when online');
  }

  return state(
    'available',
    Notification.permission === 'granted'
      ? 'Ready to enable'
      : 'Permission not requested'
  );
}

function applicationServerKey(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return buffer;
}

export async function enablePushNotifications(
  userId: string
): Promise<PushNotificationState> {
  const unsupported = supportState();
  if (unsupported) return unsupported;
  if (!userId) return state('unsupported', 'Sign in to enable notifications');
  if (getConnectivitySnapshot().status !== 'online') {
    return state('available', 'Connect to the internet to enable');
  }

  // Keep the browser permission request in the original click activation.
  // In particular, iOS Home Screen web apps may reject a request that waits
  // for a network round-trip before calling requestPermission().
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return state('blocked', 'Permission was not granted');
  }

  const config = await getPushConfig();
  if (!config.enabled || !config.publicKey) {
    return state('unconfigured', 'Push delivery is not configured');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(config.publicKey),
    });
  }

  await registerSubscription(userId, subscription);
  await setPushActiveUser(userId);
  return state('enabled', 'Enabled on this device', true);
}

export async function disablePushNotifications(
  userId: string
): Promise<PushNotificationState> {
  const unsupported = supportState();
  if (unsupported?.status === 'unsupported') return unsupported;

  const subscription = supportsWebPush()
    ? await getLocalSubscription()
    : null;
  if (subscription && getConnectivitySnapshot().status === 'online') {
    try {
      await sendAppAction({
        action: 'unregister_push_subscription',
        expectedUserId: userId,
        endpoint: subscription.endpoint,
      });
    } catch (error) {
      console.warn('[pushNotifications] server unsubscribe failed:', error);
    }
  }
  if (subscription) {
    await subscription.unsubscribe();
  }
  return getPushNotificationState(userId);
}
