/** Owner-scoped offline mirror. Settings collection is the synced choice. */
export const PERSONAL_SOLO_SETTING_KEY = 'personalSoloMode';
const prefix = 'mosaic_personal_solo_v1_';
const listeners = new Set<() => void>();
const sessionMirror = new Map<string, boolean>();
let revision = 0;
const key = (id: string): string => prefix + encodeURIComponent(id);
export function getPersonalSoloMode(userId: string | null | undefined): boolean {
  if (!userId) return false;
  if (sessionMirror.has(userId)) return sessionMirror.get(userId) === true;
  try { return localStorage.getItem(key(userId)) === '1'; }
  catch { return true; } // Unable to read the local choice: suppress social.
}
export function setPersonalSoloMode(userId: string, disabled: boolean): void {
  if (!userId || getPersonalSoloMode(userId) === disabled) return;
  sessionMirror.set(userId, disabled);
  try {
    if (disabled) localStorage.setItem(key(userId), '1');
    else localStorage.removeItem(key(userId));
  } catch { /* The in-memory mirror remains active until reload. */ }
  revision++;
  for (const listener of listeners) listener();
}
export function subscribePersonalSolo(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getPersonalSoloRevision(): number {
  return revision;
}
