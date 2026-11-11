/** Only existing Home-owned interfaces; never dispatch consequential actions. */
type HomeIntentCallbacks = {
  onConsume: () => void;
  onSearch: () => void;
  onMenu: (action: 'menu' | 'categories') => void;
  onView: (view: 'calendar' | 'todo' | 'diary') => void;
};

export function processHomeGestureIntent(action: unknown, handlers: HomeIntentCallbacks): void {
  if (action === 'search') {
    // Preserve Home Search's existing history entry and focus behavior.
    handlers.onConsume();
    queueMicrotask(handlers.onSearch);
  } else if (action === 'menu' || action === 'categories') {
    handlers.onMenu(action);
    handlers.onConsume();
  } else if (action === 'calendar' || action === 'todo' || action === 'diary') {
    handlers.onView(action);
    handlers.onConsume();
  }
}
