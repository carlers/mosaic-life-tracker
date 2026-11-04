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
interface CommonEffect { id: number; ownerId: string; pathname: string; }
interface BurstEffect extends CommonEffect, Point {
  kind: 'burst';
  animation: Exclude<CompletionAnimation, 'off'>;
}
interface DayEffect extends CommonEffect {
  kind: 'day';
  day: string;
  color?: string;
}
type Effect = BurstEffect | DayEffect;
let nextEffectId = 0;
const REJOICE_BURST_COUNT = 8;
const BURST_COUNT = 20;
const DAY_CONFETTI_COUNT = 56;
const CELEBRATION_COLORS = ['#fbbf24', '#fb7185', '#38bdf8', '#a78bfa', '#34d399', '#f97316'];

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
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    color: candidate.dataset.taskCompletionColor || undefined,
  };
}

function burstParticleStyle(index: number, color?: string): React.CSSProperties {
  return {
    '--angle': `${(index * 360) / BURST_COUNT}deg`,
    '--distance': `${38 + (index % 5) * 9}px`,
    '--spin': `${index % 2 ? -480 : 480}deg`,
    '--lag': `${index % 4 * 16}ms`,
    '--particle-color': index % 4 === 0 && color ? color : CELEBRATION_COLORS[index % CELEBRATION_COLORS.length],
  } as React.CSSProperties;
}

// The original v0.86.0 Celebrate effect: eight category-colored dots that
// expand just 17–25px from the checkmark. Keep it distinct from the larger
// colorful Celebrate confetti added in v0.86.1.
function rejoiceParticleStyle(index: number): React.CSSProperties {
  return {
    '--angle': `${index * 45}deg`,
    '--distance': `${17 + (index % 2) * 8}px`,
  } as React.CSSProperties;
}

function dayParticleStyle(index: number, color?: string): React.CSSProperties {
  return {
    left: `${(index * 47.73 + (index % 4) * 7.2) % 100}%`,
    '--drift': `${(index % 7 - 3) * 30}px`,
    '--duration': `${1650 + (index % 6) * 120}ms`,
    '--lag': `${(index * 53) % 280}ms`,
    '--spin': `${index % 2 ? -850 : 850}deg`,
    '--particle-color': index % 5 === 0 && color ? color : CELEBRATION_COLORS[index % CELEBRATION_COLORS.length],
  } as React.CSSProperties;
}

/** One pointer-transparent screen overlay even when completed task rows unmount.
 * The day milestone requires a matching action from this foreground route,
 * and never replays a later background/remote sync. */
export function CompletionFeedbackLayer() {
  const { user } = useAuth();
  const { getSetting } = useSettings();
  const { effectiveReducedMotion } = useAppearance();
  const { pathname } = useLocation();
  const ownerId = user?.$id ?? '';
  const settings = resolveCompletionFeedbackSettings(getSetting(COMPLETION_FEEDBACK_SETTING_KEY, undefined));
  const [effects, setEffects] = useState<Effect[]>([]);
  const timers = useRef(new Set<number>());
  const lastCelebratedDay = useRef(new Map<string, number>());

  useEffect(() => {
    const pending = new Map<string, { point: Point | null; started: number }>();
    const recentlyCompleted = new Map<string, { point: Point | null; started: number }>();
    const unsubscribe = subscribeCompletionFeedback(({ phase, userId, taskId, day }) => {
      if (!ownerId || userId !== ownerId || document.visibilityState !== 'visible') return;
      const now = performance.now();

      if (phase === 'prepare') {
        if (pending.size > 32) pending.clear();
        pending.set(taskId, { point: findAnchor(taskId), started: now });
        if (settings.soundEnabled) prepareCompletionSound();
        return;
      }

      if (phase === 'day-complete') {
        const finished = recentlyCompleted.get(taskId);
        recentlyCompleted.delete(taskId);
        if (!settings.dayConfettiEnabled || effectiveReducedMotion || !day ||
            !finished || now - finished.started > 3000) return;
        const key = userId + ':' + day;
        if (now - (lastCelebratedDay.current.get(key) ?? -Infinity) < 3000) return;
        if (lastCelebratedDay.current.size > 24) lastCelebratedDay.current.clear();
        lastCelebratedDay.current.set(key, now);
        const id = ++nextEffectId;
        setEffects(previous => [...previous.slice(-4), {
          id, kind: 'day', ownerId, pathname, day, color: finished.point?.color,
        }]);
        const timeout = window.setTimeout(() => {
          timers.current.delete(timeout);
          setEffects(previous => previous.filter(effect => effect.id !== id));
        }, 2800);
        timers.current.add(timeout);
        return;
      }

      const begun = pending.get(taskId);
      pending.delete(taskId);
      if (!begun || now - begun.started > 15_000) return;
      if (settings.dayConfettiEnabled) {
        if (recentlyCompleted.size > 32) recentlyCompleted.clear();
        recentlyCompleted.set(taskId, { point: begun.point, started: now });
      }
      if (settings.soundEnabled) playCompletionSound(settings.soundStyle, settings.volume);
      if (effectiveReducedMotion || settings.animation === 'off' || !begun.point) return;
      const id = ++nextEffectId;
      setEffects(previous => [...previous.slice(-4), {
        id, kind: 'burst', ...begun.point!, animation: settings.animation as Exclude<CompletionAnimation, 'off'>,
        ownerId, pathname,
      }]);
      const timeout = window.setTimeout(() => {
        timers.current.delete(timeout);
        setEffects(previous => previous.filter(effect => effect.id !== id));
      }, settings.animation === 'celebrate' ? 1100 : settings.animation === 'rejoice' ? 650 : 500);
      timers.current.add(timeout);
    });
    return unsubscribe;
  }, [ownerId, pathname, effectiveReducedMotion, settings.animation, settings.dayConfettiEnabled,
    settings.soundEnabled, settings.soundStyle, settings.volume]);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timer of activeTimers) window.clearTimeout(timer);
      activeTimers.clear();
    };
  }, []);
  useEffect(() => () => { closeCompletionSound(); }, [ownerId]);

  const visibleEffects = effectiveReducedMotion ? [] :
    effects.filter(effect => effect.ownerId === ownerId && effect.pathname === pathname);
  if (!ownerId || visibleEffects.length === 0) return null;
  return createPortal(
    <div className="mosaic-completion-feedback-layer" aria-hidden="true">
      {visibleEffects.map(effect => effect.kind === 'day' ? (
        <div key={effect.id} className="mosaic-completion-day-confetti" data-completed-day={effect.day}>
          {Array.from({ length: DAY_CONFETTI_COUNT }, (_, index) => (
            <span key={index} className="mosaic-completion-day-piece"
              style={dayParticleStyle(index, effect.color)} />
          ))}
        </div>
      ) : (
        <span key={effect.id}
          className="mosaic-completion-feedback-burst"
          data-celebration={effect.animation}
          style={{ left: effect.x, top: effect.y, '--completion-color': effect.color || 'var(--mosaic-accent)' } as React.CSSProperties}>
          <span className="mosaic-completion-feedback-ring" />
          {effect.animation !== 'subtle' && Array.from({
            length: effect.animation === 'rejoice' ? REJOICE_BURST_COUNT : BURST_COUNT,
          }, (_, index) => (
            <span key={index} className="mosaic-completion-feedback-particle"
              style={effect.animation === 'rejoice'
                ? rejoiceParticleStyle(index)
                : burstParticleStyle(index, effect.color)} />
          ))}
        </span>
      ))}
    </div>,
    document.body,
  );
}
