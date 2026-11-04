import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PwaPrompt } from '../../src/components/ui/PwaPrompt';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { silenceExpectedConsole } from '../helpers/expectedConsole';

const state = vi.hoisted(() => ({
  installAvailable: false,
  updateAvailable: false,
  updatePromptOpen: false,
  updateVersion: '0.84.0' as string | null,
  updateInfo: {
    version: '0.84.0', releases: [{ version: '0.84.0',
      headline: 'Clearer update experience', changes: ['A centered dialog'] }],
  } as { version: string; releases: { version: string; headline: string; changes: string[] }[] } | null,
  applyUpdate: vi.fn().mockResolvedValue(true),
  dismissUpdate: vi.fn(),
  deferUpdate: vi.fn(),
  openUpdatePrompt: vi.fn(),
  dismissInstall: vi.fn(),
  requestInstall: vi.fn().mockResolvedValue('accepted'),
}));
vi.mock('../../src/hooks/usePwaLifecycle', () => ({ usePwaLifecycle: () => state }));

describe('PWA update and install surfaces', () => {
  let restoreConsole: () => void;
  beforeAll(() => { restoreConsole = silenceExpectedConsole(['[PWA] Update action failed:']); });
  afterAll(() => restoreConsole());
  beforeEach(() => {
    vi.clearAllMocks();
    state.installAvailable = false;
    state.updateAvailable = false;
    state.updatePromptOpen = false;
    state.updateVersion = '0.84.0';
    state.applyUpdate.mockResolvedValue(true);
  });

  it('shows the verified notes in a blocking centered dialog only when opened', async () => {
    state.updateAvailable = true;
    const { rerender } = render(<PwaPrompt />);
    expect(screen.queryByRole('dialog', { name: 'Mosaic update ready' })).toBeNull();
    state.updatePromptOpen = true;
    rerender(<PwaPrompt />);
    const modal = screen.getByRole('dialog', { name: 'Mosaic update ready' });
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveTextContent('A centered dialog');
    expect(screen.getByRole('heading', { name: 'Mosaic update ready' })).toHaveFocus();
    expect(document.getElementById('root')?.inert ?? false).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));
    await waitFor(() => expect(state.applyUpdate).toHaveBeenCalledOnce());
  });
  it('keeps Later and tomorrow as user choices, without applying', () => {
    state.updateAvailable = true;
    state.updatePromptOpen = true;
    const { rerender } = render(<PwaPrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Reminder options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remind tomorrow' }));
    expect(state.deferUpdate).toHaveBeenCalledWith('tomorrow');
    expect(state.applyUpdate).not.toHaveBeenCalled();
    state.updatePromptOpen = false;
    rerender(<PwaPrompt />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('does not steal an open BottomSheet', () => {
    state.updateAvailable = true;
    state.updatePromptOpen = true;
    render(<>
      <BottomSheet isOpen onClose={() => undefined}><button>Another sheet</button></BottomSheet>
      <PwaPrompt />
    </>);
    expect(screen.getByRole('button', { name: 'Another sheet' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Mosaic update ready' })).toBeNull();
    expect(state.applyUpdate).not.toHaveBeenCalled();
  });
  it('refuses to reload with an explicitly marked unsaved draft', () => {
    state.updateAvailable = true;
    state.updatePromptOpen = true;
    render(<>
      <div data-unsaved-changes="true">Unfinished draft</div>
      <PwaPrompt />
    </>);
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));
    expect(state.applyUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Save your current edits');
  });
  it('keeps browser installation lightweight and dismissible', async () => {
    state.installAvailable = true;
    render(<PwaPrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await waitFor(() => expect(state.requestInstall).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss install prompt' }));
    expect(state.dismissInstall).toHaveBeenCalledOnce();
  });
});
