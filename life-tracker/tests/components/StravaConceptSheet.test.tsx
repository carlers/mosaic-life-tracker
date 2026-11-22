import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, title, children }: {
    isOpen: boolean; title: string; children: React.ReactNode
  }) => isOpen ? <section role="dialog" aria-label={title}>{children}</section> : null,
}));

import { StravaConceptSheet } from '../../src/components/settings/StravaConceptSheet';

describe('Strava concept (synthetic only, #862)', () => {
  it('keeps consent and task automation unavailable, without triggering network calls', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      render(<StravaConceptSheet isOpen onClose={() => {}} />);
      expect(screen.getByRole('status')).toHaveTextContent('Sample-only UX prototype');
      expect(screen.getByRole('button', { name: /Connect to Strava/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Attach activity to task/ })).toBeDisabled();
      expect(screen.queryByRole('link', { name: /View on Strava/ })).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('switches concepts and presentation without creating any task', () => {
    render(<StravaConceptSheet isOpen onClose={() => {}} />);
    expect(screen.queryByText('Illustrative planned Mosaic task')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Linked concept' }));
    expect(screen.getByText('Illustrative planned Mosaic task')).toBeInTheDocument();
    expect(screen.getByText('Not actually linked or completed')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Display density'), { target: { value: 'minimal' } });
    expect(screen.queryByText('Distance')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText(/GPS routes and heart-rate information are intentionally excluded/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Display density'), { target: { value: 'detailed' } });
    expect(screen.getByText('Example elevation: 42 m')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Standalone' }));
    expect(screen.queryByText('Illustrative planned Mosaic task')).toBeNull();
  });

  it('does not mount prototype content when closed', () => {
    render(<StravaConceptSheet isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
