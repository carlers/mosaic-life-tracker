/** Ephemeral user-action events. Database replication never publishes them. */
export const COMPLETION_FEEDBACK_SETTING_KEY = 'taskCompletionFeedback';

export type CompletionSoundStyle = 'pop' | 'chime' | 'click' | 'sparkle';
export type CompletionAnimation = 'off' | 'subtle' | 'celebrate';
export interface CompletionFeedbackSettings {
  animation: CompletionAnimation;
  soundEnabled: boolean;
  soundStyle: CompletionSoundStyle;
  volume: number;
}

export const DEFAULT_COMPLETION_FEEDBACK: Readonly<CompletionFeedbackSettings> = {
  animation: 'subtle',
  soundEnabled: false,
  soundStyle: 'pop',
  volume: 0.3,
};

export function resolveCompletionFeedbackSettings(value: unknown): CompletionFeedbackSettings {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    animation: row.animation === 'off' || row.animation === 'celebrate' ? row.animation : 'subtle',
    soundEnabled: row.soundEnabled === true,
    soundStyle: row.soundStyle === 'chime' || row.soundStyle === 'click' ||
      row.soundStyle === 'sparkle' ? row.soundStyle : 'pop',
    volume: typeof row.volume === 'number' && Number.isFinite(row.volume)
      ? Math.min(1, Math.max(0, row.volume)) : DEFAULT_COMPLETION_FEEDBACK.volume,
  };
}

export type CompletionFeedbackPhase = 'prepare' | 'complete';
export interface CompletionFeedbackEvent {
  phase: CompletionFeedbackPhase;
  userId: string;
  taskId: string;
}
type Listener = (event: CompletionFeedbackEvent) => void;
const listeners = new Set<Listener>();

export function subscribeCompletionFeedback(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishCompletionFeedback(phase: CompletionFeedbackPhase, userId: string, taskId: string): void {
  if (!userId || !taskId) return;
  for (const listener of listeners) {
    try { listener({ phase, userId, taskId }); }
    catch { /* A purely optional effect must never interrupt task persistence. */ }
  }
}
