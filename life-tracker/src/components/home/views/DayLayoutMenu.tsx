import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, PanelBottom, PanelLeft, PanelRight, PanelsTopLeft } from 'lucide-react';
import { useSettings } from '../../../hooks/useSettings';
import {
  DAY_DETAIL_PRESENTATION_SETTING_KEY, DAY_PANEL_HEIGHT_SETTING_KEY,
  DAY_PANEL_SIDE_SETTING_KEY, resolveDayPanelHeight, resolveDayDetailPresentation,
} from '../../../lib/preferences';
import type { DayPanelSide } from '../../../lib/dayPanelLayout';
import type { DayPanelHeight } from '../../../lib/preferences';

type Placement = 'bottom' | DayPanelSide;

export const DayLayoutMenu: React.FC = () => {
  const { getSetting, setSetting } = useSettings();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 8, left: 8 });
  const presentation = resolveDayDetailPresentation(getSetting(DAY_DETAIL_PRESENTATION_SETTING_KEY, 'sheet'));
  const side = getSetting(DAY_PANEL_SIDE_SETTING_KEY, 'right') === 'left' ? 'left' : 'right';
  const height = resolveDayPanelHeight(getSetting(DAY_PANEL_HEIGHT_SETTING_KEY, 'grid'));
  const placement: Placement = presentation === 'sheet' ? 'bottom' : side;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  // The inspector and BottomSheet clip overflow. Render the popup above them
  // while tracking the trigger as panel widths/scroll positions change.
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const trigger = rootRef.current?.querySelector<HTMLButtonElement>('[data-day-layout-trigger]');
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = menuRef.current?.offsetWidth || 224;
      const height = menuRef.current?.offsetHeight || 310;
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const below = rect.bottom + 4;
      const above = rect.top - height - 4;
      const top = Math.max(8, Math.min(
        below + height > window.innerHeight && above >= 8 ? above : below,
        window.innerHeight - height - 8
      ));
      setPosition(value => value.left === left && value.top === top ? value : { left, top });
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  const changePlacement = async (next: Placement) => {
    if (saving) return;
    setSaving(true);
    try {
      if (next === 'bottom') await setSetting(DAY_DETAIL_PRESENTATION_SETTING_KEY, 'sheet');
      else {
        await setSetting(DAY_PANEL_SIDE_SETTING_KEY, next);
        await setSetting(DAY_DETAIL_PRESENTATION_SETTING_KEY, 'panel');
      }
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };
  const changeHeight = async (next: DayPanelHeight) => {
    if (saving) return;
    setSaving(true);
    try {
      await setSetting(DAY_PANEL_HEIGHT_SETTING_KEY, next);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const itemClass = 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-primary hover:bg-surfaceHighlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mosaic-accent)]';
  const placementOptions = [
    { value: 'bottom' as const, label: 'Bottom', Icon: PanelBottom },
    { value: 'left' as const, label: 'Left', Icon: PanelLeft },
    { value: 'right' as const, label: 'Right', Icon: PanelRight },
  ];
  return (
    <div className="relative shrink-0" ref={rootRef} data-testid="day-layout-menu"
      onKeyDownCapture={event => {
        if (!open) return;
        const trigger = rootRef.current?.querySelector<HTMLButtonElement>('[data-day-layout-trigger]');
        if (event.key === 'Escape') {
          event.stopPropagation();
          setOpen(false);
          trigger?.focus();
          return;
        }
        if (event.key !== 'Tab' && event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const controls = [trigger, ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not([disabled])') ?? [])]
          .filter((button): button is HTMLButtonElement => Boolean(button));
        if (controls.length < 2) return;
        const current = controls.indexOf(event.target as HTMLButtonElement);
        const direction = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1;
        const next = (Math.max(0, current) + direction + controls.length) % controls.length;
        event.preventDefault();
        event.stopPropagation();
        controls[next].focus();
      }}>
      <button type="button" data-day-layout-trigger
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--mosaic-border)] bg-surfaceHighlight text-secondary hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mosaic-accent)]"
        aria-label="Change Day View layout" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen(value => !value)}>
        <PanelsTopLeft size={17} aria-hidden="true" />
      </button>
      {open && createPortal(
        <div ref={menuRef} role="menu" aria-label="Day View layout"
          style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 180 }}
          className="w-56 rounded-xl border border-[var(--mosaic-border)] bg-surface p-2 shadow-xl">
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-secondary">Position</p>
          {placementOptions.map(({ value, label, Icon }) => (
            <button key={value} type="button" role="menuitemradio" aria-checked={placement === value}
              disabled={saving} onClick={() => void changePlacement(value)} className={itemClass}>
              <Icon size={16} aria-hidden="true" /> <span className="flex-1">{label}</span>
              {placement === value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
          <div className="my-2 border-t border-[var(--mosaic-border)]" />
          <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-secondary">Panel height</p>
          {([
            ['grid', 'Align with calendar'],
            ['screen', 'Full screen height'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" role="menuitemradio" aria-checked={height === value}
              disabled={saving || placement === 'bottom'}
              onClick={() => void changeHeight(value)} className={itemClass}>
              <span className="flex-1">{label}</span>
              {height === value && <Check size={15} aria-hidden="true" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
