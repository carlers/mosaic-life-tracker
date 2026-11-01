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
    expect(Object.keys(FEATURE_DISABLE_FLAGS)).toHaveLength(39);
    for (const feature of Object.keys(FEATURE_DISABLE_FLAGS) as Array<keyof typeof FEATURE_DISABLE_FLAGS>) {
      expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS[feature])).toBe(true);
    }
  });

  it('binds every operator control to a unique, canonical, non-empty PostHog key', () => {
    const flagKeys = Object.values(FEATURE_DISABLE_FLAGS);
    expect(flagKeys).toHaveLength(39);
    expect(new Set(flagKeys).size).toBe(flagKeys.length);
    for (const flag of flagKeys) {
      expect(flag).toMatch(/^mosaic_disable_[a-z]+(?:_[a-z]+)*$/);
      // The exact registry value must be the one evaluated remotely.
      disabled.add(flag);
      expect(isFeatureEnabled(flag)).toBe(false);
      disabled.delete(flag);
      expect(isFeatureEnabled(flag)).toBe(true);
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
    disabled.add(FEATURE_DISABLE_FLAGS.keyboardShortcuts);
    disabled.add(FEATURE_DISABLE_FLAGS.calendarTaskPreviews);
    disabled.add(FEATURE_DISABLE_FLAGS.taskTimestamps);
    disabled.add(FEATURE_DISABLE_FLAGS.dayViewDiaryPanel);
    for (const key of [
      FEATURE_DISABLE_FLAGS.keyboardShortcuts,
      FEATURE_DISABLE_FLAGS.calendarTaskPreviews,
      FEATURE_DISABLE_FLAGS.taskTimestamps,
      FEATURE_DISABLE_FLAGS.dayViewDiaryPanel,
    ]) {
      expect(isFeatureEnabled(key)).toBe(false);
    }
    for (const flag of [FEATURE_DISABLE_FLAGS.bucketListCreation, FEATURE_DISABLE_FLAGS.friendRequests, FEATURE_DISABLE_FLAGS.pushEnrollment]) {
      disabled.add(flag);
      expect(isFeatureEnabled(flag)).toBe(false);
      expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.settingsSearch)).toBe(true);
      disabled.delete(flag);
      expect(isFeatureEnabled(flag)).toBe(true);
    }
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.settingsSearch)).toBe(true);
    disabled.clear();
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.keyboardShortcuts)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.friendDiscovery)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.stickerPackDiscovery)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.todoMateImport)).toBe(true);
    expect(isFeatureEnabled(FEATURE_DISABLE_FLAGS.taskPhotoUpload)).toBe(true);
  });
});
