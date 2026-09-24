import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/pages/AccountPage', () => ({
  AccountPage: () => <div>Actual Me neighbor content</div>,
}));
vi.mock('../../src/pages/ExplorePage', () => ({
  ExplorePage: () => <div>Actual Explore neighbor content</div>,
}));
vi.mock('../../src/pages/HomePage', () => ({
  HomePage: () => <div>Actual Home neighbor content</div>,
}));
vi.mock('../../src/pages/MessagesPage', () => ({
  MessagesPage: () => <div>Actual Chat neighbor content</div>,
}));
vi.mock('../../src/pages/SettingsPage', () => ({
  SettingsPage: () => <div>Actual Settings neighbor content</div>,
}));
vi.mock('../../src/components/layout/ComingSoon', () => ({
  ComingSoon: () => <div>Actual Alerts neighbor content</div>,
}));

import { PrimaryRoutePreview } from '../../src/components/layout/PrimaryRoutePreview';

// Regression: PROJECT_REFERENCE.md §2 — an active route drag mounts the actual
// directional route after its code was prefetched; shells are fallback only.
describe('PrimaryRoutePreview', () => {
  it('renders actual adjacent route content rather than the shell when the chunk is ready', async () => {
    render(<PrimaryRoutePreview pathname="/account" />);
    expect(await screen.findByText('Actual Me neighbor content')).toBeInTheDocument();
  });
});
