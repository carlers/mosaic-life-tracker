import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: () => false,
}));
import { useHolidaysByDate } from '../../src/hooks/useHolidays';

describe('Holiday indicator operator control', () => {
  it('suppresses calendar and Day View holiday results without changing a saved user config', () => {
    const config = {
      enabled: true,
      countryCode: 'PH',
      types: 'public-and-observances',
    } as const;
    const { result } = renderHook(() => useHolidaysByDate(config, [2026]));
    expect(result.current.size).toBe(0);
    expect(config.enabled).toBe(true);
  });
});
