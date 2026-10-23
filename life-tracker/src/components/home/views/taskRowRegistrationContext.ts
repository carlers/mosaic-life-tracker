import { createContext } from 'react';

// Shared by TaskRowDropSurface and the draggable task child. Keep outside
// component modules so React Fast Refresh can safely reload those files.
export const TaskRowRegistrationContext = createContext(true);
