import { describe, expect, it } from 'vitest';
import { isE2eePilotSettingsLocation } from '../../src/lib/crypto/pilotRoute';

describe('hidden synthetic E2EE pilot route guard', () => {
  it('requires exact Settings path and a single opt-in query flag', () => {
    expect(isE2eePilotSettingsLocation('/settings', '?e2eePilot=1')).toBe(true);
    for (const [path, search] of [
      ['/settings', ''], ['/settings/', '?e2eePilot=1'],
      ['/home', '?e2eePilot=1'], ['/settings/account', '?e2eePilot=1'],
      ['/settings', '?e2eePilot=0'], ['/settings', '?e2eePilot=1&e2eePilot=1'],
      ['/settings', '?E2eePilot=1'], ['/settings', '?e2eePilot=1%00'],
    ]) {
      expect(isE2eePilotSettingsLocation(path, search), path + search).toBe(false);
    }
    // Navigation/gesture previews never preload this experimental editor.
    expect(isE2eePilotSettingsLocation('/settings', '?e2eePilot=1', '/settings')).toBe(false);
  });
});
