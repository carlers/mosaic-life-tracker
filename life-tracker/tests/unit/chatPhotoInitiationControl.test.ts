import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ enabled: false, dbRead: vi.fn() }));
vi.mock('../../src/lib/featureControls', () => ({ isFeatureEnabled: () => state.enabled }));
vi.mock('../../src/db/database', () => ({ getDatabase: state.dbRead }));
vi.mock('../../src/lib/messageDelivery', () => ({ deliverPendingMessages: vi.fn() }));
import { sendPhotoMessage } from '../../src/lib/chatPhotoComposer';
describe('chat photo initiation pause', () => {
  it('rejects new uploads before staging files or writing rows', async () => {
    await expect(sendPhotoMessage('owner', 'friend', new File(['photo'], 'photo.png', { type: 'image/png' })))
      .rejects.toThrow('New chat photos are temporarily unavailable.');
    expect(state.dbRead).not.toHaveBeenCalled();
  });
});
