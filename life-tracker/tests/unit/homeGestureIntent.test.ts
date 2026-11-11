import { describe, expect, it } from 'vitest';
import { processHomeGestureIntent } from '../../src/lib/homeGestureIntent';

function record() {
  const log: string[] = [];
  return {
    log,
    handlers: {
      onConsume: () => { log.push('consume'); },
      onSearch: () => { log.push('search'); },
      onMenu: (action: 'menu' | 'categories') => { log.push('menu:' + action); },
      onView: (view: 'calendar' | 'todo' | 'diary') => { log.push('view:' + view); },
    },
  };
}

describe('Home gesture intent route handoff', () => {
  it('ignores unknown and consequential actions without changing Home', () => {
    const { log, handlers } = record();
    for (const action of [undefined, null, 'delete-task', 'settings', 'backlogs', {}, []]) {
      processHomeGestureIntent(action, handlers);
    }
    expect(log).toEqual([]);
  });

  it('consumes menu, category, and view requests exactly once per call', () => {
    for (const action of ['menu', 'categories', 'calendar', 'todo', 'diary'] as const) {
      const { log, handlers } = record();
      processHomeGestureIntent(action, handlers);
      expect(log).toEqual([
        action === 'menu' || action === 'categories' ? 'menu:' + action : 'view:' + action,
        'consume',
      ]);
    }
  });

  it('consumes route state before activating Home Search history', async () => {
    const { log, handlers } = record();
    processHomeGestureIntent('search', handlers);
    expect(log).toEqual(['consume']);
    await Promise.resolve();
    expect(log).toEqual(['consume', 'search']);
  });
});
