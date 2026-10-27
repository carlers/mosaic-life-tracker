import { describe, expect, it } from 'vitest';
import { SETTINGS_SEARCH_ENTRIES, searchSettings } from '../../src/lib/settingsSearch';
import { matchProtectedRoute } from '../../src/lib/protectedRoutes';
import { resolveRouteParent } from '../../src/lib/primarySwipeNavigation';

describe('Settings search', () => {
  it('finds individual settings and aliases without remote data', () => {
    expect(searchSettings('weekday').some((item) => item.label === 'Keep weekday header visible' && item.path === '/settings/preferences/calendar')).toBe(true);
    expect(searchSettings('logout')[0]?.label).toBe('Sign Out');
    expect(searchSettings('color').some((item) => item.path === '/settings/preferences/appearance')).toBe(true);
    expect(searchSettings('backup')[0]?.path).toBe('/settings/data');
    expect(searchSettings('push').some((item) => item.label === 'Enable push notifications')).toBe(true);
    expect(searchSettings('message reactions').some((item) => item.path === '/settings/notifications')).toBe(true);
    expect(searchSettings('  ')).toEqual([]);
  });
  it('points all indexed entries to registered protected settings routes', () => {
    for (const item of SETTINGS_SEARCH_ENTRIES) {
      const route = matchProtectedRoute(item.path);
      expect(route?.kind).toBe('detail');
      expect(item.label.length).toBeGreaterThan(0);
    }
    expect(resolveRouteParent('/settings/account')).toBe('/settings');
    expect(resolveRouteParent('/settings/account', { parentPath: '/account' })).toBe('/account');
  });
});