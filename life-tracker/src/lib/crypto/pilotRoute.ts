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
