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
 ¶»§q«^