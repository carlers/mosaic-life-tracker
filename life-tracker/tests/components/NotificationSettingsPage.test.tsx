import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPushNotificationState: vi.fn(),
  enablePushNotifications: vi.fn(),
  disablePushNotifications: vi.fn(),
  setPushDetails: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_a' } }),
}));
vi.mock('../../src/lib/pushNotifications', () => ({
  getPushNotificationState: mocks.getPushNotificationState,
  enablePushNotifications: mocks.enablePushNotifications,
  disablePushNotifications: mocks.disablePushNotifications,
  setPushDetails: mocks.setPushDetails,
}));

import { NotificationSettingsPage } from '../../src/pages/NotificationSettingsPage';

describe('NotificationSettingsPage', () => {
  beforeEach(() => {
    mocks.getPushNotificationState.mockReset().mockResolvedValue({
      status: 'unconfigured', enabled: false, label: 'Push delivery is not configured',
    });
    mocks.enablePushNotifications.mockReset();
    mocks.disablePushNotifications.mockReset();
    mocks.setPushDetails.mockReset();
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
  it('keeps details hidden until an enabled device preference is verified', async () => {
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'enabled', enabled: true, detailsEnabled: null, label: 'Enabled on this device',
    });
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    const details = await screen.findByRole('switch', { name: 'Show task details in notifications' });
    expect(details).toBeDisabled();
    expect(mocks.setPushDetails).not.toHaveBeenCalled();
  });

  it('lets a subscribed device opt in to rich task details', async () => {
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'enabled', enabled: true, detailsEnabled: false, label: 'Enabled on this device',
    });
    mocks.setPushDetails.mockResolvedValue({
      status: 'enabled', enabled: true, detailsEnabled: true, label: 'Enabled on this device',
    });
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    const details = await screen.findByRole('switch', { name: 'Show task details in notifications' });
    await waitFor(() => expect(details).toBeEnabled());
    fireEvent.click(details);
    await waitFor(() => expect(mocks.setPushDetails).toHaveBeenCalledWith('user_a', true));
    expect(details).toBeChecked();
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

  it('explains iOS installation when the browser tab cannot subscribe', async () => {
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'install-required', enabled: false,
      label: 'Install Mosaic to your Home Screen first',
    });
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    expect(await screen.findByText(/open Mosaic in Safari/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Push friend completions' })).toBeDisabled();
  });

  it('explains how to restore blocked notification permissions', async () => {
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'blocked', enabled: false, label: 'Blocked in system or browser settings',
    });
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    expect(await screen.findByText(/Notifications are blocked/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Push friend completions' })).toBeDisabled();
  });

});
