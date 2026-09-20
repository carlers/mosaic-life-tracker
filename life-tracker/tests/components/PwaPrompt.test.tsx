import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PwaPrompt } from '../../src/components/ui/PwaPrompt';
import { silenceExpectedConsole } from '../helpers/expectedConsole';

const mocks = vi.hoisted(() => ({
  applyUpdate: vi.fn().mockResolvedValue(true),
  dismissInstall: vi.fn(),
  dismissUpdate: vi.fn(),
  requestInstall: vi.fn().mockResolvedValue('accepted'),
  installAvailable: false,
  updateAvailable: false,
}));

vi.mock('../../src/hooks/usePwaLifecycle', () => ({
  usePwaLifecycle: () => mocks,
}));

describe('PwaPrompt', () => {
  let restoreConsole: () => void;

  beforeAll(() => {
    restoreConsole = silenceExpectedConsole(['[PWA] Update action failed:']);
  });

  afterAll(() => restoreConsole());

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.installAvailable = false;
    mocks.updateAvailable = false;
  });

  it('stays hidden when neither browser action is available', () => {
    const { container } = render(<PwaPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('requires an explicit click before applying an update', async () => {
    mocks.updateAvailable = true;
    render(<PwaPrompt />);

    expect(screen.getByRole('complementary', { name: 'App update available' })).toBeInTheDocument();
    expect(mocks.applyUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));
    await waitFor(() => expect(mocks.applyUpdate).toHaveBeenCalledOnce());
  });

  it('lets the user defer a waiting update', () => {
    mocks.updateAvailable = true;
    render(<PwaPrompt />);

    fireEvent.click(screen.getByRole('button', { name: 'Update later' }));
    expect(mocks.dismissUpdate).toHaveBeenCalledOnce();
    expect(mocks.applyUpdate).not.toHaveBeenCalled();
  });

  it('keeps a failed update actionable and announces the error', async () => {
    mocks.updateAvailable = true;
    mocks.applyUpdate.mockRejectedValueOnce(new Error('activation failed'));
    render(<PwaPrompt />);

    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Update failed. Please try again.');
    expect(screen.getByRole('button', { name: 'Update now' })).toBeEnabled();
  });

  it('offers the captured browser install prompt and allows dismissal', async () => {
    mocks.installAvailable = true;
    render(<PwaPrompt />);

    expect(screen.getByRole('complementary', { name: 'Install Mosaic' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await waitFor(() => expect(mocks.requestInstall).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss install prompt' }));
    expect(mocks.dismissInstall).toHaveBeenCalledOnce();
  });
});
