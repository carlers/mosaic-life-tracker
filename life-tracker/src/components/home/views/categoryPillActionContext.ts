import { createContext } from 'react';
import type { CategoryPillActions } from './CategorySection';

export const CategoryPillActionContext = createContext<CategoryPillActions | null>(null);

/** Yield nested task-row layout projection while the enclosing category is dragged. */
export const CategoryReorderDragContext = createContext(false);
