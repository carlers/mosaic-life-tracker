import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/releaseHistory', () => ({
  loadReleaseHistory: loadMock,
  readCachedReleaseHistory: () => null,
  RELEASES_PAGE_URL: 'https://github.com/carlers/mosaic-life-tracker/releases',
}));
import { ReleaseHistoryPage } from '../../src/pages/ReleaseHistoryPage';

const published = {
  tag: 'v0.6.2', date: '2026-10-08T00:00:00Z',
  summary: 'Mosaic improvements', notes: '- **Better** task controls', milestones: [],
  url: 'https://github.com/carlers/mosaic-life-tracker/releases/tag/v0.6.2',
};
function page() {
  return render(
    <MemoryRouter initialEntries={['/settings/releases']}>
      <Routes>
        <Route path="/settings" element={<p>Settings destination</p>} />
        <Route path="/settings/releases" element={<ReleaseHistoryPage />} />
      </Routes>
    </MemoryRouter>
  );
}
beforeEach(() => { loadMock.mockReset(); });

describe('ReleaseHistoryPage', () => {
  it('shows published release notes, expandable details, and returns to Settings', async () => {
    loadMock.mockResolvedValue({ releases: [published], source: 'live', fetchedAt: Date.now() });
    page();
    expect(await screen.findByText('Mosaic improvements')).toBeInTheDocument();
    expect(screen.getByText('v0.6.2')).toBeInTheDocument();
    fireEvent.click(screen.getByText('v0.6.2').closest('summary')!);
    expect(screen.getByText('Better')).toBeInTheDocument();
    expect(screen.getByText('Better').tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: /View production release/i }))
      .toHaveAttribute('href', published.url);
    fireEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
    expect(screen.getByText('Settings destination')).toBeInTheDocument();
  });

  it('distinguishes empty, saved offline and unavailable responses', async () => {
    loadMock.mockResolvedValueOnce({ releases: [], source: 'live', fetchedAt: Date.now() })
      .mockResolvedValueOnce({ releases: [published], source: 'cached', fetchedAt: Date.now() })
      .mockResolvedValueOnce({ releases: [], source: 'unavailable', fetchedAt: null });
    const { unmount } = page();
    expect(await screen.findByText(/No production releases published/)).toBeInTheDocument();
    unmount();
    const saved = page();
    expect(await screen.findByText(/Saved history/)).toBeInTheDocument();
    saved.unmount();
    page();
    expect(await screen.findByRole('alert')).toHaveTextContent(/History unavailable/);
  });

  it('shows each verified patch/minor version with safe formatted Markdown', async () => {
    loadMock.mockResolvedValue({ releases: [{
      ...published, milestones: [
        { tag: 'v0.16.5', title: 'Sticker improvements',
          notes: '- **Static** stickers\n- [Details](https://github.com/example/release)\n- [Unsafe](javascript:alert)' },
        { tag: 'v0.16.4', title: 'Task fixes', notes: '## Fixes\n- More reliable editing' },
      ],
    }], source: 'live', fetchedAt: Date.now() });
    page();
    expect(await screen.findByText('v0.16.5')).toBeInTheDocument();
    expect(screen.getByText('v0.16.4')).toBeInTheDocument();
    fireEvent.click(screen.getByText('v0.16.5').closest('summary')!);
    expect(screen.getByText('Static').tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: 'Details' })).toHaveAttribute('href', 'https://github.com/example/release');
    expect(screen.queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument();
  });

  it('retries on demand without repeatedly loading on re-render', async () => {
    loadMock.mockResolvedValueOnce({ releases: [], source: 'unavailable', fetchedAt: null })
      .mockResolvedValueOnce({ releases: [published], source: 'live', fetchedAt: Date.now() });
    page();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh release history' }));
    await waitFor(() => expect(screen.getByText('v0.6.2')).toBeInTheDocument());
    expect(loadMock).toHaveBeenCalledTimes(2);
    expect(loadMock.mock.calls[1][0]).toBe(true);
  });
});
