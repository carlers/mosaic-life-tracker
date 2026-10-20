import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

/** Controlled, single-choice popup. Consumers own their values and persistence. */
export interface MosaicSelectOption {
  value: string;
  label: string;
  description?: string;
  color?: string;
  textColor?: string;
  disabled?: boolean;
}

export interface MosaicSelectProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly MosaicSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  variant?: 'default' | 'compact' | 'category';
  className?: string;
}

export const MosaicSelect: React.FC<MosaicSelectProps> = ({
  id, label, value, onChange, options, placeholder = 'Choose option',
  disabled = false, variant = 'default', className = '',
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const typeaheadRef = useRef('');
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{
    top: number; left: number; width: number; maxHeight: number;
  } | null>(null);
  const uniqueOptions = useMemo(() => {
    const values = new Set<string>();
    return options.filter(option => {
      if (values.has(option.value)) return false;
      values.add(option.value);
      return true;
    });
  }, [options]);
  const selected = uniqueOptions.find(option => option.value === value);
  const selectedLabel = selected?.label ?? placeholder;
  const isCategory = variant === 'category';
  const isCompact = variant === 'compact';

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const show = () => {
    if (disabled || uniqueOptions.length === 0) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const width = Math.min(isCategory ? 288 : 320,
      Math.max(rect.width, 176), window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const below = window.innerHeight - rect.bottom - margin * 2;
    const above = rect.top - margin * 2;
    const placeBelow = below >= 176 || below >= above;
    const maxHeight = Math.max(0, Math.min(280, placeBelow ? below : above));
    const top = placeBelow ? rect.bottom + margin : rect.top - margin - maxHeight;
    setPosition({ top, left, width, maxHeight });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    const focusOutside = (event: FocusEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    const scroll = (event: Event) => {
      if (!popupRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', focusOutside);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    const frame = requestAnimationFrame(() => {
      const options = popupRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]:not([aria-disabled="true"])'
      );
      (Array.from(options ?? []).find(element => element.getAttribute('aria-selected') === 'true')
        ?? options?.[0])?.focus();
    });
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', focusOutside);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  useEffect(() => () => {
    if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
  }, []);

  const choose = (next: MosaicSelectOption) => {
    if (next.disabled) return;
    if (next.value !== value) onChange(next.value);
    close(true);
  };

  const onPopupKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    const items = Array.from(popupRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="option"]:not([aria-disabled="true"])'
    ) ?? []);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowDown' ? (current + 1) % items.length
        : (current < 0 ? items.length - 1 : (current + items.length - 1) % items.length);
      items[next]?.focus();
      return;
    }
    if (event.key === 'Tab') {
      // Options are portaled to body, so explicitly resume tab order at the trigger.
      event.preventDefault();
      event.stopPropagation();
      const trigger = triggerRef.current;
      const scope = trigger?.closest<HTMLElement>('[role="dialog"]') ?? document.body;
      const focusable = Array.from(scope.querySelectorAll<HTMLElement>(
        'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]'
      )).filter(element => !element.hasAttribute('disabled') &&
        element.getAttribute('tabindex') !== '-1' &&
        !element.closest('[aria-hidden="true"]'));
      const currentIndex = trigger ? focusable.indexOf(trigger) : -1;
      const target = focusable[currentIndex + (event.shiftKey ? -1 : 1)] ?? trigger;
      close();
      target?.focus();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.stopPropagation();
      return;
    }
    if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;
    event.stopPropagation();
    const search = (typeaheadRef.current + event.key).toLocaleLowerCase();
    typeaheadRef.current = search;
    if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
    typeaheadTimer.current = setTimeout(() => { typeaheadRef.current = ''; }, 650);
    const next = items.find(item => {
      const option = uniqueOptions.find(option => option.value === item.dataset.value);
      return option?.label.toLocaleLowerCase().startsWith(search);
    }) ?? items.find(item => {
      const option = uniqueOptions.find(option => option.value === item.dataset.value);
      return option?.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase());
    });
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <div ref={rootRef}
      className={'relative inline-flex min-w-0 max-w-full ' + className}
      onPointerDown={event => event.stopPropagation()}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label + ': ' + selectedLabel}
        disabled={disabled || uniqueOptions.length === 0}
        onClick={() => open ? close() : show()}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            if (!open) show();
          }
        }}
        className={
          (isCategory
            ? 'mosaic-category-pill rounded-full bg-black py-1 pl-3.5 pr-1 text-[0.9375rem] font-bold'
            : isCompact
              ? 'rounded-full border border-[#444444] bg-surfaceHighlight py-2 pl-3 pr-2 text-xs font-semibold'
              : 'rounded-xl border border-[#444444] bg-surfaceHighlight px-3 py-2 text-sm font-medium'
          ) +
          ' inline-flex w-full min-w-0 max-w-full items-center justify-between gap-2 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-50'
        }>
        <span className="min-w-0 truncate" style={selected?.textColor ? { color: selected.textColor } : undefined}>
          {selectedLabel}
        </span>
        <span aria-hidden="true" className={isCategory
          ? 'mosaic-category-add-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400'
          : 'inline-flex shrink-0 items-center justify-center text-gray-400'}>
          <ChevronDown size={isCategory ? 18 : 14} className={'transition-transform ' + (open ? 'rotate-180' : '')} />
        </span>
      </button>
      {open && position && createPortal(
        <div
          ref={popupRef}
          id={menuId}
          role="listbox"
          aria-label={label}
          onKeyDown={onPopupKeyDown}
          onPointerDown={event => event.stopPropagation()}
          style={{ position: 'fixed', zIndex: 1000, top: position.top, left: position.left,
            width: position.width, maxHeight: position.maxHeight }}
          className="overflow-y-auto overscroll-contain rounded-2xl border border-[#444444] bg-surface p-1.5 shadow-2xl"
        >
          {uniqueOptions.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              data-value={option.value}
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              disabled={option.disabled}
              tabIndex={-1}
              onClick={() => choose(option)}
              className="flex w-full min-w-36 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white hover:bg-surfaceHighlight focus:bg-surfaceHighlight focus:outline-none disabled:opacity-50"
            >
              {option.color && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: option.color }} />}
              <span className="min-w-0 flex-1 break-words"
                style={option.textColor ? { color: option.textColor } : undefined}>
                {option.label}
                {option.description && <span className="block text-xs font-normal text-gray-400">{option.description}</span>}
              </span>
              {option.value === value && <Check size={16} className="shrink-0 text-gray-300" aria-hidden="true" />}
            </button>
          ))}
        </div>, document.body)}
    </div>
  );
};
