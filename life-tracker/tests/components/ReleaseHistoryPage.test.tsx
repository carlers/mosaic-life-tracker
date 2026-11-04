import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const productionLoad = vi.hoisted(() => vi.fn());
const developmentLoad = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/releaseHistory', () => ({
  loadReleaseHistory: productionLoad,
  readCachedReleaseHistory: () => null,
  previewOnlyMilestones: () => [{
    tag: 'v0.13.0', title: 'Historical Preview', notes: '- An earlier prototype',
    url: 'https://github.com/carlers/mosaic-life-tracker/pull/486',
  }],
  RELEASES_PAGE_URL: 'https://github.com/carlers/mosaic-life-tracker/releases',
}));
vi.mock('../../src/lib/developmentHistory', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/lib/developmentHistory')>()),
  loadDevelopmentHistory: developmentLoad,
  readCachedDevelopmentHistory: () => null,
}));
import { ReleaseHistoryPage } from '../../src/pages/ReleaseHistoryPage';

const a = 'a'.repeat(40);
const b = 'b'.repeat(40);
const event = {
  id: 'preview:' + a, stage: 'preview', tag: 'v0.82.0',
  sha: a, lineageId: a, branch: 'feature/release-history',
  recordedAt: '2026-11-04T00:00:00Z', title: 'Unified history',
  notes: '- **Preview** updates are visible',
  url: 'https://github.com/carlers/mosaic-life-tracker/commit/' + a,
};
const official = {
  tag: 'v0.81.9', date: '2026-11-03T00:00:00Z',
  summary: 'Task editing improvements', notes: '- **Tap away** to save',
  milestones: [{
    tag: 'v0.81.8', title: 'Settings sync correction', notes: '- Fix invalid row IDs',
  }],
  url: 'https://github.com/carlers/mosaic-life-tracker/releases/tag/v0.81.9',
};
function page() {
  return render(
    <MemoryRouter initialEntries={['/settings/releases']}>
      <Routes>
        <Route path="/settings" element={<p>Settings destination</p>} />
        <Route path="/settings/releases" element={<ReleaseHistoryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  productionLoad.mockReset().mockResolvedValue({
    releases: [official], source: 'live', fetchedAt: Date.now(),
  });
  developmentLoad.mockReset().mockResolvedValue({
    events: [event], source: 'live', fetchedAt: Date.now(),
  });
});

describe('unified Release History page', () => {
  it('shows installed build, all channels, expandable notes and retains navigation', async () => {
    page();
    expect(await screen.findByText('Unified history')).toBeInTheDocument();
    expect(screen.getByText('Task editing improvements')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Filter release history/ })).toBeInTheDocument();
    expect(screen.getByText('Your installed version')).toBeInTheDocument();
    fireEvent.click(screen.getByText('v0.82.0').closest('summary')!);
    expect(screen.getByText('Preview', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View verified commit/ })).toHaveAttribute('href', event.url);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
    expect(screen.getByText('Settings destination')).toBeInTheDocument();
  });

  it('filters Dev and Preview independently from official Production releases', async () => {
    developmentLoad.mockResolvedValue({ events: [event, {
      ...event, stage: 'dev', id: 'dev:' + b, sha: b, branch: 'dev',
      url: 'https://github.com/carlers/mosaic-life-tracker/commit/' + b,
      recordedAt: '2026-11-05T00:00:00Z',
    }], source: 'live', fetchedAt: Date.now() });
    page();
    await screen.findByText('Unified history');
    const filters = screen.getByRole('group', { name: /Filter release history/ });
    fireEvent.click(within(filters).getByRole('button', { name: 'Dev' }));
    expect(screen.getByText('Unified history')).toBeInTheDocument();
    expect(screen.queryByText('Task editing improvements')).not.toBeInTheDocument();
    fireEvent.click(within(filters).getByRole('button', { name: 'Production' }));
    expect(screen.getByText('Task editing improvements')).toBeInTheDocument();
    expect(screen.queryByText('Unified history')).not.toBeInTheDocument();
    fireEvent.click(within(filters).getByRole('button', { name: 'Preview' }));
    expect(screen.getByText('Unified history')).toBeInTheDocument();
    expect(screen.getAllByText('Historical Preview').length).toBeGreaterThan(0);
    expect(screen.queryByText('Task editing improvements')).not.toBeInTheDocument();
    fireEvent.click(within(filters).getByRole('button', { name: 'All' }));
    expect(screen.getByText('Task editing improvements')).toBeInTheDocument();
  });

  it('keeps Production milestones nested and displays their safe Markdown', async () => {
    page();
    await screen.findByText('Task editing improvements');
    fireEvent.click(screen.getByText('v0.81.9').closest('summary')!);
    expect(screen.getByText('Tap away').tagName).toBe('STRONG');
    expect(screen.getByText('v0.81.8')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View official Production release/ }))
      .toHaveAttribute('href', official.url);
  });

  it('supports stale saved and unavailable feeds separately, and retries on request', async () => {
    productionLoad.mockResolvedValue({ releases: [official], source: 'cached', fetchedAt: Date.now() });
    developmentLoad.mockResolvedValueOnce({ events: [], source: 'unavailable', fetchedAt: null })
      .mockResolvedValueOnce({ events: [event], source: 'live', fetchedAt: Date.now() });
    page();
    expect(await screen.findByText(/Live Dev\/Preview history is unavailable/)).toBeInTheDocument();
    expect(screen.getByText('Task editing improvements')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh release history' }));
    await waitFor(() => expect(screen.getByText('Unified history')).toBeInTheDocument());
    expect(developmentLoad.mock.calls[1][0]).toBe(true);
  });
});
