import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const refs = vi.hoisted(() => ({
  saveTaskImage: vi.fn(),
  saveProfileImage: vi.fn(),
}));

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({user: {$id: 'owner_a'}}),
}));
vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => true,
}));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: () => true,
}));
vi.mock('../../src/hooks/useSheetReset', () => ({
  useSheetReset: () => {},
}));
vi.mock('../../src/lib/storage', () => ({
  saveTaskImage: refs.saveTaskImage,
  saveProfileImage: refs.saveProfileImage,
}));
vi.mock('../../src/components/ui/BottomSheet', () => ({
  BottomSheet: ({children, isOpen}: {children: ReactNode; isOpen:boolean}) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));

import { ImagePickerSheet } from '../../src/components/home/views/ImagePickerSheet';

afterEach(() => {
  vi.restoreAllMocks();
  refs.saveTaskImage.mockReset();
  refs.saveProfileImage.mockReset();
});

describe('image picker reference-only remove', () => {
  it('prevents concurrent removal/upload and closes only after the reference change succeeds', async () => {
    let finish!: () => void;
    const onRemove = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const onClose = vi.fn();
    const onSave = vi.fn();
    const { container } = render(
      <ImagePickerSheet isOpen variant="task" title="Task Photo"
        hasExistingImage onClose={onClose} onSave={onSave} onRemove={onRemove} />
    );

    fireEvent.click(screen.getByRole('button', {name:'Remove Current Photo'}));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name:'Removing photo...'})).toBeDisabled();

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeDisabled();
    fireEvent.change(input!, {target:{files:[new File(['image'],'test.png',{type:'image/png'})]}});
    expect(refs.saveTaskImage).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => finish());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('keeps the picker open after a failed removal and allows retry', async () => {
    const error = vi.spyOn(console,'error').mockImplementation(() => {});
    const onRemove = vi.fn().mockRejectedValueOnce(new Error('stale photo'))
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(
      <ImagePickerSheet isOpen variant="task" title="Task Photo"
        hasExistingImage onClose={onClose} onSave={vi.fn()} onRemove={onRemove} />
    );

    fireEvent.click(screen.getByRole('button', {name:'Remove Current Photo'}));
    await waitFor(() => expect(screen.getByRole('alert'))
      .toHaveTextContent('Failed to remove image. Please try again.'));
    expect(onClose).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', {name:'Remove Current Photo'}));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onRemove).toHaveBeenCalledTimes(2);
  });
});
