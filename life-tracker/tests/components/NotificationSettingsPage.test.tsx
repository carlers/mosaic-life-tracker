import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPushNotificationState: vi.fn(),
  enablePushNotifications: vi.fn(),
  disablePushNotifications: vi.fn(),
  setPushDetails: vi.fn(),
  getPushWhileOpen: vi.fn(),
  setPushWhileOpen: vi.fn(),
  canDisableForegroundPush: vi.fn(),
  retentionSettings: {} as Record<string, unknown>,
  setSetting: vi.fn(),
}));

vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({
    getSetting: (key: string, fallback?: unknown) => mocks.retentionSettings[key] ?? fallback,
    setSetting: mocks.setSetting,
  }),
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { $id: 'user_a' } }),
}));
vi.mock('../../src/lib/pushNotifications', () => ({
  getPushNotificationState: mocks.getPushNotificationState,
  enablePushNotifications: mocks.enablePushNotifications,
  disablePushNotifications: mocks.disablePushNotifications,
  setPushDetails: mocks.setPushDetails,
  getPushWhileOpen: mocks.getPushWhileOpen,
  setPushWhileOpen: mocks.setPushWhileOpen,
  canDisableForegroundPush: mocks.canDisableForegroundPush,
}));

import { NotificationSettingsPage } from '../../src/pages/NotificationSettingsPage';

describe('NotificationSettingsPage', () => {
  beforeEach(() => {
    mocks.retentionSettings = {};
    mocks.setSetting.mockReset().mockResolvedValue(undefined);
    mocks.getPushNotificationState.mockReset().mockResolvedValue({
      status: 'unconfigured', enabled: false, label: 'Push delivery is not configured',
    });
    mocks.enablePushNotifications.mockReset();
    mocks.disablePushNotifications.mockReset();
    mocks.setPushDetails.mockReset();
    mocks.getPushWhileOpen.mockReset().mockResolvedValue(true);
    mocks.setPushWhileOpen.mockReset().mockResolvedValue(undefined);
    mocks.canDisableForegroundPush.mockReset().mockReturnValue(true);
  });
  it('explains retention and does not request permission when push is unconfigured', async () => {
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^Unread alerts:/ })).toHaveTextContent('7 days');
    expect(screen.getByRole('combobox', { name: /^Read alerts:/ })).toHaveTextContent('24 hours');
    const switchControl = screen.getByRole('switch', { name: 'Enable push notifications' });
    await waitFor(() => expect(switchControl).toBeDisabled());
    fireEvent.click(switchControl);
    expect(mocks.enablePushNotifications).not.toHaveBeenCalled();
  });
  it('saves account-scoped independent in-app and push choices per event category', async () => {
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    const messageFeed = screen.getByRole('checkbox', { name: 'Messages in-app Alerts' });
    const reactionPush = screen.getByRole('checkbox', { name: 'Message reactions push' });
    expect(messageFeed).toBeChecked();
    expect(reactionPush).not.toBeChecked();
    fireEvent.click(messageFeed);
    await waitFor(() => expect(mocks.setSetting).toHaveBeenCalledWith(
      'alertsChannels', expect.objectContaining({
        direct_message: { feed: false, push: true },
      })
    ));
  });

  it('offers separate account-synced retention choices and keeps push independent', async () => {
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    const unread = screen.getByRole('combobox', { name: /^Unread alerts:/ });
    const read = screen.getByRole('combobox', { name: /^Read alerts:/ });
    expect(unread).toHaveTextContent('7 days');
    expect(read).toHaveTextContent('24 hours');
    fireEvent.click(unread);
    expect(screen.getByRole('option', { name: '30 days' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: '14 days' }));
    fireEvent.click(read);
    fireEvent.click(screen.getByRole('option', { name: '7 days' }));
    expect(mocks.setSetting).toHaveBeenCalledWith('alertsUnreadRetentionDays', 14);
    expect(mocks.setSetting).toHaveBeenCalledWith('alertsReadRetentionHours', 168);
    expect(mocks.enablePushNotifications).not.toHaveBeenCalled();
  });

  it('shows a validated account policy and preserves settings after bad saved values', () => {
    mocks.retentionSettings = {
      alertsUnreadRetentionDays: 30,
      alertsReadRetentionHours: 72,
    };
    const { rerender } = render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    expect(screen.getByRole('combobox', { name: /^Unread alerts:/ })).toHaveTextContent('30 days');
    expect(screen.getByRole('combobox', { name: /^Read alerts:/ })).toHaveTextContent('3 days');
    mocks.retentionSettings = {
      alertsUnreadRetentionDays: -1,
      alertsReadRetentionHours: 'never',
    };
    rerender(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    expect(screen.getByRole('combobox', { name: /^Unread alerts:/ })).toHaveTextContent('7 days');
    expect(screen.getByRole('combobox', { name: /^Read alerts:/ })).toHaveTextContent('24 hours');
  });

  it('saves an independent on-device foreground setting without changing push registration', async () => {
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'enabled', enabled: true, detailsEnabled: false, label: 'Enabled on this device',
    });
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    const toggle = await screen.findByRole('switch', { name: 'Notify while Mosaic is open' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    await waitFor(() => expect(mocks.setPushWhileOpen).toHaveBeenCalledWith(false));
    expect(toggle).not.toBeChecked();
    expect(mocks.disablePushNotifications).not.toHaveBeenCalled();
  });

  it('preserves the foreground setting when persistence fails', async () => {
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'enabled', enabled: true, detailsEnabled: false, label: 'Enabled on this device',
    });
    mocks.setPushWhileOpen.mockRejectedValue(new Error('IndexedDB quota'));
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    const toggle = await screen.findByRole('switch', { name: 'Notify while Mosaic is open' });
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this device preference.');
    expect(toggle).toBeChecked();
  });

  it('disables foreground suppression on Safari/WebKit browsers', async () => {
    mocks.canDisableForegroundPush.mockReturnValue(false);
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'enabled', enabled: true, detailsEnabled: false, label: 'Enabled on this device',
    });
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    const toggle = await screen.findByRole('switch', { name: 'Notify while Mosaic is open' });
    await waitFor(() => expect(toggle).toBeDisabled());
    expect(screen.getByText(/Other browsers, including iOS Safari/)).toBeInTheDocument();
    expect(mocks.setPushWhileOpen).not.toHaveBeenCalled();
  });

  it('shows a backend-update reason when detailed task notifications cannot be verified', async () => {
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'enabled', enabled: true, detailsEnabled: null,
      detailsError: 'Requires Appwrite notification backend update',
      label: 'Enabled on this device',
    });
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    expect(await screen.findByText('Requires Appwrite notification backend update')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show task details in notifications' })).toBeDisabled();
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
    expect(screen.getByRole('switch', { name: 'Enable push notifications' })).toBeDisabled();
  });

  it('explains how to restore blocked notification permissions', async () => {
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'blocked', enabled: false, label: 'Blocked in system or browser settings',
    });
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    expect(await screen.findByText(/Notifications are blocked/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Enable push notifications' })).toBeDisabled();
  });

  it('requires separate account consent and device detail consent for social push text', async () => {
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'enabled', enabled: true, detailsEnabled: false, label: 'Enabled',
    });
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    const social = await screen.findByRole('switch', {
      name: 'Show message and reaction previews in push',
    });
    expect(social).toBeDisabled();
    expect(social).not.toBeChecked();
    fireEvent.click(social);
    expect(mocks.setSetting).not.toHaveBeenCalledWith('alertsSocialPushDetails', true);
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'enabled', enabled: true, detailsEnabled: true, label: 'Enabled',
    });
    // A fresh mount reads the verified per-device state.
  });

  it('saves a separate opt-in without altering the existing task-title device preference', async () => {
    mocks.getPushNotificationState.mockResolvedValue({
      status: 'enabled', enabled: true, detailsEnabled: true, label: 'Enabled',
    });
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>);
    const social = await screen.findByRole('switch', {
      name: 'Show message and reaction previews in push',
    });
    await waitFor(() => expect(social).toBeEnabled());
    expect(social).not.toBeChecked();
    fireEvent.click(social);
    await waitFor(() => expect(mocks.setSetting).toHaveBeenCalledWith(
      'alertsSocialPushDetails', true
    ));
    expect(mocks.setPushDetails).not.toHaveBeenCalled();
  });

});
