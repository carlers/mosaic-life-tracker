/**
 * Exact hidden synthetic-pilot opt-in on the existing Settings route.
 * Not an authentication control: the pilot page and server independently
 * require exact Scratch project, authenticated MFA, and an owner allowlist.
 */
export function isE2eePilotSettingsLocation(
  pathname: string, search: string, previewPathname?: string,
): boolean {
  if (previewPathname !== undefined || pathname !== '/settings') return false;
  const query = new URLSearchParams(search);
  const flags = query.getAll('e2eePilot');
  return flags.length === 1 && flags[0] === '1';
}

/**
 * Exact, independently opt-in isolated Scratch M2 owner test lab.
 * Does not activate normal Mosaic encrypted sync, Appwrite Function flags,
 * or the server-side old-PWA legacy writer floor.
 */
export function isE2eeM2SettingsLocation(
  pathname: string, search: string, previewPathname?: string,
): boolean {
  if (previewPathname !== undefined || pathname !== '/settings') return false;
  const query = new URLSearchParams(search);
  const flags = query.getAll('e2eeM2');
  return flags.length === 1 && flags[0] === '1' && !query.has('e2eePilot');
}
