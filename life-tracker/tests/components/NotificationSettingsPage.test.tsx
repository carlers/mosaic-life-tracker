import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
});
