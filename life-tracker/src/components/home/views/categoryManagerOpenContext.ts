import { createContext } from 'react';

// Context avoids threading an unrelated sheet callback through the Day Slide,
// virtualized category-reorder layer and task-rendering props.
export const CategoryManagerOpenContext = createContext<((categoryId: string) => void) | null>(null);
