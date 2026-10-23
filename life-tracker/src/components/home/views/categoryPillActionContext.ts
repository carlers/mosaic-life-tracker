import { createContext } from 'react';
import type { CategoryPillActions } from './CategorySection';

export const CategoryPillActionContext = createContext<CategoryPillActions | null>(null);
