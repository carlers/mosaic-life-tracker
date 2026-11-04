import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAppearance } from '../../hooks/useAppearance';
import { useSettings } from '../../hooks/useSettings';
import {
  COMPLETION_FEEDBACK_SETTING_KEY,
  resolveCompletionFeedbackSettings,
  subscribeCompletionFeedback,
  type CompletionAnimation,
} from '../../lib/completionFeedback';
import { closeCompletionSound, playCompletionSound, prepareCompletionSound } from '../../lib/completionAudio';
import './CompletionFeedbackLayer.css';

interface Point { x: number; y: number; color?: string; }
interface Effect extends Point { id: number; animation: Exclude<CompletionAnimation, 'off'>; }
let nextEffectId = 0;

function findAnchor(taskId: string): Point | null {
  const active = document.activeElement;
  const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-task-completion-id]'));
  const matched = elements.filter(element => element.dataset.taskCompletionId === taskId);
  const candidate = matched.includes(active as HTMLElement) ? active as HTMLElement : matched.find(element => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 &&
      rect.bottom >= 0 && rect.top <= window.innerHeight;
  });
  if (!candidate) return null;
  const rect = candidate.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, color: candidate.dataset.taskCompletionColor || undefined };
}

/** Single noninteractive overlay shared by every task view, including views
 * where the completed row unmounts before its feedback finishes. */
export function CompletionFeedbackLayer() {
  const { user } = useAuth();
  const { getSetting } = useSettings();
  const { effectiveReducedMotion } = useAppearance();
  const { pathname } = useLocation();
  const ownerId = user?.$id ?? '';
  const settings = resolveCompletionFeedbackSettings(getSetting(COMPLETION_FEEDBACK_SETTING_KEY, undefined));
  const currentSettings = useRef(settings);
  currentSettings.current = settings;
  const [effects, setEffects] = useState<Effect[]>([]);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const pending = new Map<string, { point: Point | null; started: number }>();
    const unsubscribe = subscribeCompletionFeedback(({ phase, userId, taskId }) => {
      if (!ownerId || userId !== ownerId || document.visibilityState !== 'visible') return;
      if (phase === 'prepare') {
        if (pending.size > 32) pending.clear();
        pending.set(taskId, { point: findAnchor(taskId), started: performance.now() });
        if (currentSettings.current.soundEnabled) prepareCompletionSound();
        return;
      }
      const begun = pending.get(taskId);
      pending.delete(taskId);
      // Feedback must originate in this foreground session, not from a remote
      // replay, import, stale promise, or account transition.
      if (!begun || performance.now() - begun.started > 15_000) return;
      const choice = currentSettings.current;
      if (choice.soundEnabled) playCompletionSound(choice.soundStyle, choice.volume);
      if (effectiveReducedMotion || choice.animation === 'off' || !begun.point) return;
      const id = ++nextEffectId;
      setEffects(previous => [...previous.slice(-3), { id, ...begun.point!, animation: choice.animation as Exclude<CompletionAnimation, 'off'> }]);
      const timeout = window.setTimeout(() => {
        timers.current.delete(timeout);
        setEffects(previous => previous.filter(effect => effect.id !== id));
      }, 700);
      timers.current.add(timeout);
    });
    return () => {
      unsubscribe();
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current.clear();
      closeCompletionSound();
    };
  }, [ownerId, effectiveReducedMotion]);

  useEffect(() => { setEffects([]); }, [pathname, ownerId, effectiveReducedMotion]);

  if (!ownerId || effects.length === 0) return null;
  return createPortal(
    <div className="mosaic-completion-feedback-layer" aria-hidden="true">
      {effects.map(effect => (
        <span key={effect.id} className="mosaic-completion-feedback-burst"
          style={{ left: effect.x, top: effect.y, '--completion-color': effect.color || 'var(--mosaic-accent)' } as React.CSSProperties}>
          <span className="mosaic-completion-feedback-ring" />
          {effect.animation === 'celebrate' && Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="mosaic-completion-feedback-particle"
              style={{ '--angle': `${i * 45}deg`, '--distance': `${17 + (i % 2) * 8}px` } as React.CSSProperties} />
          ))}
        </span>
      ))}
    </div>,
    document.body,
  );
}
