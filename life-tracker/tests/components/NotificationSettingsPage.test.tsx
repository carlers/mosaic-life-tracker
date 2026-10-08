import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPushNotificationState: vi.fn(),
  enablePushNotifications: vi.fn(),
  disablePushNotifications: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_a' } }),
}));
vi.mock('../../src/lib/pushNotifications', () => ({
  getPushNotificationState: mocks.getPushNotificationState,
  enablePushNotifications: mocks.enablePushNotifications,
  disablePushNotifications: mocks.disablePushNotifications,
}));

import { NotificationSettingsPage } from '../../src/pages/NotificationSettingsPage';

describe('NotificationSettingsPage', () => {
  beforeEach(() => {
    mocks.getPushNotificationState.mockReset().mockResolvedValue({
      status: 'unconfigured', enabled: false, label: 'Push delivery is not configured',
    });
    mocks.enablePushNotifications.mockReset();
    mocks.disablePushNotifications.mockReset();
  });
  it('explains retention and does not request permission when push is unconfigured', async () => {
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText(/Unread alerts stay for 7 days/)).toBeInTheDocument();
    const switchControl = screen.getByRole('switch', { name: 'Push friend completions' });
    await waitFor(() => expect(switchControl).toBeDisabled());
    fireEvent.click(switchControl);
    expect(mocks.enablePushNotifications).not.toHaveBeenCalled();
  });
  it('returns to Alerts through browser history when opened from the Alerts gear', async () => {
    render(
      <MemoryRouter initialEntries={[
        '/notifications',
        { pathname: '/settings/notifications', state: { parentPath: '/notifications', fromAlerts: true } },
      ]} initialIndex={1}>
        <Routes>
          <Route path="/notifications" element={<p>Alerts route</p>} />
          <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back to Alerts' }));
    expect(await screen.findByText('Alerts route')).toBeInTheDocument();
  });

  it('falls back to Settings on direct navigation without parent history', async () => {
    render(
      <MemoryRouter initialEntries={['/settings/notifications']}>
        <Routes>
          <Route path="/settings" element={<p>Settings route</p>} />
          <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
    expect(await screen.findByText('Settings route')).toBeInTheDocument();
  });

});
