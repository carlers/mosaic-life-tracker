import { beforeEach, describe, expect, it, vi } from 'vitest';

const disabled = vi.hoisted(() => new Set<string>());

vi.mock('../../src/lib/posthog', () => ({
  getPostHogFeatureFlagState: (key: string) => ({
    enabled: disabled.has(key),
    isLoaded: true,
    hasError: false,
  }),
}));

import { FEATURE_DISABLE_FLAGS, isFeatureEnabled } from '../../src/lib/featureControls';

describe('operational feature controls', () => {
  beforeEach(() => disabled.clear());

  it('starts with all supported optional features available', () => {
    expect(Object.keys(FEATURE_DISABLE_FLAGS)).toHaveLength(7);
    for (const feature of Object.keys(FEATURE_DISABLE_FLAGS) as Array<keyof typeof FEATURE_DISABLE_FLAGS>) {
      expect(isFeatureEnabled(feature)).toBe(true);
    }
  });

  it('disables only the matching feature, and re-enables without erasing other states', () => {
    disabled.add(FEATURE_DISABLE_FLAGS.taskPhotoUpload);
    expect(isFeatureEnabled('taskPhotoUpload')).toBe(false);
    expect(isFeatureEnabled('diaryPhotoUpload')).toBe(true);
    expect(isFeatureEnabled('taskSearch')).toBe(true);
    expect(isFeatureEnabled('todoMateImport')).toBe(true);
    disabled.add(FEATURE_DISABLE_FLAGS.todoMateImport);
    expect(isFeatureEnabled('todoMateImport')).toBe(false);
    expect(isFeatureEnabled('taskSearch')).toBe(true);
    disabled.clear();
    expect(isFeatureEnabled('todoMateImport')).toBe(true);
    expect(isFeatureEnabled('taskPhotoUpload')).toBe(true);
  });
});
