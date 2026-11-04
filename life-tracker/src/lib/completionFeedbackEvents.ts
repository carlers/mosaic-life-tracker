/** Small task-action boundary, independent of optional animation/audio settings.
 * Keep event listeners registered in the authenticated Preview layer only. */
export type CompletionFeedbackPhase = 'prepare' | 'complete' | 'day-complete';
export interface CompletionFeedbackEvent {
  phase: CompletionFeedbackPhase;
  userId: string;
  taskId: string;
  day?: string;
}
type Listener = (event: CompletionFeedbackEvent) => void;
const listeners = new Set<Listener>();

export function subscribeCompletionFeedback(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishCompletionFeedback(
  phase: CompletionFeedbackPhase, userId: string, taskId: string, day?: string
): void {
  if (!userId || !taskId) return;
  const event: CompletionFeedbackEvent = { phase, userId, taskId, ...(day ? { day } : {}) };
  for (const listener of listeners) {
    try { listener(event); }
    catch { /* Optional effects must never interrupt task persistence. */ }
  }
}
