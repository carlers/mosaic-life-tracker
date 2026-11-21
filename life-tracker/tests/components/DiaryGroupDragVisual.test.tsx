import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { captureDiaryGroupDragSnapshot } from '../../src/components/home/views/diaryGroupDragSnapshot';
import { DiaryGroupDragVisual } from '../../src/components/home/views/DiaryGroupDragVisual';

describe('DiaryGroupDragVisual', () => {
  it('carries only the multi-entry group header, not entries or its controls, while leaving the original intact', () => {
    const source = document.createElement('section');
    source.innerHTML = `<div data-diary-drag-source="true">
      <div data-diary-drag-visual="true" style="margin-top:8px;margin-bottom:8px">
        <section data-diary-drag-group="true" data-testid="diary-day-group"
          style="padding-top:8px;padding-bottom:8px">
          <button data-diary-drag-heading="true" id="group-header">
            <span data-diary-dnd-source="true"></span>3 diary entries
          </button>
          <button>Diary entry order</button>
          <div id="entry-one">Morning note</div>
          <div id="entry-two">Afternoon note</div>
          <div id="entry-three">Evening note</div>
        </section>
      </div>
    </div>`;
    document.body.append(source);
    const visual = source.querySelector<HTMLElement>('[data-diary-drag-visual]')!;
    const heading = source.querySelector<HTMLElement>('[data-diary-drag-heading]')!;
    vi.spyOn(visual, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 4, top: 4, left: 0, width: 320, height: 210,
      right: 320, bottom: 214, toJSON: () => ({}),
    });
    vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue({
      x: 8, y: 12, top: 12, left: 8, width: 140, height: 28,
      right: 148, bottom: 40, toJSON: () => ({}),
    });
    const captured = captureDiaryGroupDragSnapshot(source.querySelector('[data-diary-dnd-source]'));
    expect(captured).not.toBeNull();
    const { container, unmount } = render(<DiaryGroupDragVisual snapshot={captured!}/>);
    const overlay = container.querySelector<HTMLElement>('[data-diary-drag-overlay]');
    expect(overlay?.textContent).toContain('3 diary entries');
    expect(overlay?.textContent).not.toContain('Morning note');
    expect(overlay?.textContent).not.toContain('Afternoon note');
    expect(overlay?.textContent).not.toContain('Evening note');
    expect(overlay?.textContent).not.toContain('Diary entry order');
    expect(overlay?.hasAttribute('inert')).toBe(true);
    expect(overlay?.querySelector('[data-diary-dnd-source]')).toBeNull();
    expect(overlay?.querySelector('#group-header')).toBeNull();
    expect(overlay?.querySelector('[data-testid="diary-day-group"]')).toBeNull();
    expect(visual.querySelector('#group-header')).not.toBeNull();
    expect(visual.textContent).toContain('Evening note');
    expect(captured?.width).toBe(320);
    expect(captured?.height).toBe(60);
    expect(captured!.height).toBeLessThan(210);
    unmount();
    expect(visual.textContent).toContain('Evening note');
    source.remove();
  });

  it('retains the ordinary single-entry card when there is no group header', () => {
    const source = document.createElement('div');
    source.innerHTML = `<div data-diary-drag-source="true"><div data-diary-drag-visual="true">
      <button>One diary entry<span data-diary-dnd-source="true"></span></button>
    </div></div>`;
    document.body.append(source);
    const captured = captureDiaryGroupDragSnapshot(source.querySelector('[data-diary-dnd-source]'));
    expect(captured?.node.textContent).toContain('One diary entry');
    expect(captured?.node.querySelector('[data-diary-dnd-source]')).toBeNull();
    source.remove();
  });

  it('does not clone an absent diary source or a card from a different container', () => {
    const alien = document.createElement('div');
    alien.innerHTML = '<div data-diary-drag-visual>Other user</div>';
    document.body.append(alien);
    const source = document.createElement('div');
    document.body.append(source);
    expect(captureDiaryGroupDragSnapshot(source)).toBeNull();
    expect(captureDiaryGroupDragSnapshot(null)).toBeNull();
    source.remove();
    alien.remove();
  });
});
