import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PwaPrompt } from '../../src/components/ui/PwaPrompt';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
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

  // Regression: app-root notices must not sit above an active modal while
  // remaining inert/unfocusable. Availability survives nested and closing sheets.
  it('defers an update through nested sheet layers and resumes it after they clear', async () => {
    mocks.updateAvailable = true;
    const parent = <BottomSheet isOpen onClose={() => undefined}><button>Parent action</button></BottomSheet>;
    const nested = <BottomSheet isOpen onClose={() => undefined}><button>Nested action</button></BottomSheet>;
    const { rerender } = render(<>{parent}{nested}<PwaPrompt /></>);

    expect(screen.queryByRole('complementary', { name: 'App update available' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Nested action' })).toHaveFocus();

    rerender(<>{parent}<PwaPrompt /></>);
    expect(screen.queryByRole('complementary', { name: 'App update available' })).toBeNull();

    rerender(<PwaPrompt />);
    expect(screen.getByRole('complementary', { name: 'App update available' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));
    await waitFor(() => expect(mocks.applyUpdate).toHaveBeenCalledOnce());
  });

  it('hides an install notice when a sheet opens without consuming the install offer', async () => {
    mocks.installAvailable = true;
    const { rerender } = render(<PwaPrompt />);
    expect(screen.getByRole('button', { name: 'Install' })).toBeEnabled();

    rerender(
      <>
        <BottomSheet isOpen onClose={() => undefined}>
          <button>Sheet action</button>
        </BottomSheet>
        <PwaPrompt />
      </>
    );
    expect(screen.queryByRole('complementary', { name: 'Install Mosaic' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sheet action' })).toHaveFocus();
    expect(mocks.dismissInstall).not.toHaveBeenCalled();

    rerender(<PwaPrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await waitFor(() => expect(mocks.requestInstall).toHaveBeenCalledOnce());
    // A dismissed system install request must not leave subsequent offers disabled.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Install' })).toBeEnabled());
  });
});
