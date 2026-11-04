/** Ephemeral user-action events. Database replication never publishes them. */
export const COMPLETION_FEEDBACK_SETTING_KEY = 'taskCompletionFeedback';

export type CompletionSoundStyle =
  'pop' | 'chime' | 'click' | 'sparkle' | 'ding' | 'bubble' | 'arcade' | 'tada';
export type CompletionAnimation = 'off' | 'subtle' | 'rejoice' | 'celebrate';

export const COMPLETION_ANIMATION_OPTIONS: readonly { value: CompletionAnimation; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'rejoice', label: 'Rejoice' },
  { value: 'celebrate', label: 'Celebrate' },
];

export function isCompletionAnimation(value: unknown): value is CompletionAnimation {
  return COMPLETION_ANIMATION_OPTIONS.some(option => option.value === value);
}

export const COMPLETION_SOUND_OPTIONS: readonly { value: CompletionSoundStyle; label: string }[] = [
  { value: 'pop', label: 'Soft pop' },
  { value: 'chime', label: 'Chime' },
  { value: 'click', label: 'Click' },
  { value: 'sparkle', label: 'Sparkle' },
  { value: 'ding', label: 'Ding' },
  { value: 'bubble', label: 'Bubble' },
  { value: 'arcade', label: 'Arcade' },
  { value: 'tada', label: 'Ta-da' },
];

export function isCompletionSoundStyle(value: unknown): value is CompletionSoundStyle {
  return COMPLETION_SOUND_OPTIONS.some(option => option.value === value);
}

export interface CompletionFeedbackSettings {
  animation: CompletionAnimation;
  soundEnabled: boolean;
  soundStyle: CompletionSoundStyle;
  volume: number;
  dayConfettiEnabled: boolean;
}

export const DEFAULT_COMPLETION_FEEDBACK: Readonly<CompletionFeedbackSettings> = {
  animation: 'subtle',
  soundEnabled: false,
  soundStyle: 'pop',
  volume: 0.6,
  dayConfettiEnabled: false,
};

export function resolveCompletionFeedbackSettings(value: unknown): CompletionFeedbackSettings {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    animation: isCompletionAnimation(row.animation) ? row.animation : 'subtle',
    soundEnabled: row.soundEnabled === true,
    soundStyle: isCompletionSoundStyle(row.soundStyle) ? row.soundStyle : 'pop',
    volume: typeof row.volume === 'number' && Number.isFinite(row.volume)
      ? Math.min(1, Math.max(0, row.volume)) : DEFAULT_COMPLETION_FEEDBACK.volume,
    dayConfettiEnabled: row.dayConfettiEnabled === true,
  };
}

export {
  isScheduledCompletionDay,
  isCompletedDayAfterTaskChange,
  subscribeCompletionFeedback,
  publishCompletionFeedback,
} from './completionFeedbackEvents';
export type { CompletionFeedbackPhase, CompletionFeedbackEvent } from './completionFeedbackEvents';
