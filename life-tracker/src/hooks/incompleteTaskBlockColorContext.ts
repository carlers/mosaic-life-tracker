import { createContext } from 'react';
import type { IncompleteTaskBlockColorMode } from '../lib/preferences';

export const IncompleteTaskBlockColorContext = createContext<IncompleteTaskBlockColorMode>('default');
