import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TourInvite from '../../src/components/onboarding/TourInvite';

describe('optional first-run tour invitation', () => {
  it('retains accessible offer and separate skip/start actions after code splitting', () => {
    const onSkip = vi.fn();
    const onStart = vi.fn();
    render(<TourInvite onSkip={onSkip} onStart={onStart} />);
    expect(screen.getByRole('complementary', { name: 'Optional Mosaic tour' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Take a tour' }));
    expect(onStart).toHaveBeenCalledOnce();
  });
});
