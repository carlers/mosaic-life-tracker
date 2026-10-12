import { render, screen } from '@testing-library/react';
import { PwaAssetProgressView } from '../../src/components/ui/PwaAssetProgressView';

describe('PWA update asset progress', () => {
  it('reports actual staged build bytes and a bounded percentage, not network transfer', () => {
    render(<PwaAssetProgressView progress={{
      completed: 2, total: 5, completedBytes: 234000, totalBytes: 500000,
    }} />);
    expect(screen.getByText('234/500 KB · 47%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Preparing app files' }))
      .toHaveAttribute('aria-valuenow', '47');
  });

  it('uses verified file counts when asset byte sizes are unknown', () => {
    render(<PwaAssetProgressView progress={{
      completed: 1, total: 4, completedBytes: null, totalBytes: null,
    }} />);
    expect(screen.getByText('1/4 files · 25%')).toBeInTheDocument();
    expect(screen.queryByText(/KB/)).not.toBeInTheDocument();
  });
});
