import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { captureDiaryGroupDragSnapshot } from '../../src/components/home/views/diaryGroupDragSnapshot';
import { DiaryGroupDragVisual } from '../../src/components/home/views/DiaryGroupDragVisual';

describe('DiaryGroupDragVisual', () => {
  it('carries the entire multi-entry diary group as one inert visual and keeps the source intact', () => {
    const source = document.createElement('section');
    source.innerHTML = `<div data-diary-drag-source="true">
      <div data-diary-dnd-source="true"></div>
      <div data-diary-drag-visual="true" class="my-2">
        <section data-testid="diary-day-group"><button id="group-header">3 diary entries</button>
          <div id="entry-one">Morning note</div>
          <div id="entry-two">Afternoon note</div>
          <div id="entry-three">Evening note</div>
        </section>
      </div>
    </div>`;
    document.body.append(source);
    const visual = source.querySelector<HTMLElement>('[data-diary-drag-visual]')!;
    vi.spyOn(visual, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 4, top: 4, left: 0, width: 320, height: 210,
      right: 320, bottom: 214, toJSON: () => ({}),
    });
    const captured = captureDiaryGroupDragSnapshot(source.querySelector('[data-diary-dnd-source]'));
    expect(captured).not.toBeNull();
    const { container, unmount } = render(<DiaryGroupDragVisual snapshot={captured!}/>);
    const overlay = container.querySelector<HTMLElement>('[data-diary-drag-overlay]');
    expect(overlay?.textContent).toContain('3 diary entries');
    expect(overlay?.textContent).toContain('Morning note');
    expect(overlay?.textContent).toContain('Afternoon note');
    expect(overlay?.textContent).toContain('Evening note');
    expect(overlay?.hasAttribute('inert')).toBe(true);
    expect(overlay?.querySelector('#group-header')).toBeNull();
    expect(overlay?.querySelector('[data-testid="diary-day-group"]')).toBeNull();
    expect(visual.querySelector('#group-header')).not.toBeNull();
    expect(visual.querySelector('[data-testid="diary-day-group"]')).not.toBeNull();
    expect(captured?.width).toBe(320);
    expect(captured?.height).toBeGreaterThanOrEqual(210);
    unmount();
    expect(visual.textContent).toContain('Evening note');
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
