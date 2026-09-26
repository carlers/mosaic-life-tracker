// Regression: §2 (large screens can rotate; phone portrait is best-effort).
import { describe, expect, it, vi } from 'vitest';
import { configureResponsiveOrientation } from '../../src/lib/orientation';

describe('responsive orientation', () => {
  it('unlocks orientation on tablet-sized screens', async () => {
    const unlock = vi.fn();
    await configureResponsiveOrientation({
      screenWidth: 1024,
      screenHeight: 768,
      orientation: { unlock, lock: vi.fn() },
    });
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('best-effort locks portrait on phone-sized screens', async () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    await configureResponsiveOrientation({
      screenWidth: 390,
      screenHeight: 844,
      orientation: { unlock: vi.fn(), lock },
    });
    expect(lock).toHaveBeenCalledWith('portrait');
  });
});
