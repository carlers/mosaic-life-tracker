import { createPreloadedLazy } from '../../../lib/createPreloadedLazy';

// Both owner and friend surfaces share one warmed module and one lazy cache.
// Loading the module does not mount its expensive Day View / drag runtime.
export const { Component: LazyTodoListView, preload: preloadTodoListView } =
  createPreloadedLazy(() =>
    import('./TodoListView').then(({ TodoListView }) => TodoListView)
  );
