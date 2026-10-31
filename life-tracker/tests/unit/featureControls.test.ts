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
    expect(Object.keys(FEATURE_DISABLE_FLAGS)).toHaveLength(14);
    for (const feature of Object.keys(FEATURE_DISABLE_FLAGS) as Array<keyof typeof FEATURE_DISABLE_FLAGS>) {
      expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS[feature])).toBe(true);
    }
  });

  it('disables only the matching feature, and re-enables without erasing other states', () => {
    disabled.add(FEATURE_DISABLE_FLAGS.taskPhotoUpload);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.taskPhotoUpload)).toBe(false);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.diaryPhotoUpload)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.taskSearch)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.todoMateImport)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.friendDiscovery)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.profilePhotoUpload)).toBe(true);
    disabled.add(FEATURE_DISABLE_FLAGS.todoMateImport);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.todoMateImport)).toBe(false);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.taskSearch)).toBe(true);
    disabled.add(FEATURE_DISABLE_FLAGS.holidayIndicators);
    disabled.add(FEATURE_DISABLE_FLAGS.timelineMode);
    disabled.add(FEATURE_DISABLE_FLAGS.calendarPinchZoom);
    disabled.add(FEATURE_DISABLE_FLAGS.profilePhotoUpload);
    disabled.add(FEATURE_DISABLE_FLAGS.profileSharing);
    disabled.add(FEATURE_DISABLE_FLAGS.friendDiscovery);
    disabled.add(FEATURE_DISABLE_FLAGS.stickerPackDiscovery);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.profilePhotoUpload)).toBe(false);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.taskPhotoUpload)).toBe(false);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.diaryPhotoUpload)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.chatSearch)).toBe(true);
    disabled.clear();
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.friendDiscovery)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.stickerPackDiscovery)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.todoMateImport)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.taskPhotoUpload)).toBe(true);
  });
});
