import { useHomeViewKeyboardShortcuts } from '../../../hooks/useHomeViewKeyboardShortcuts';
import type { ViewType } from '../ViewSwitcher';

export function HomeViewShortcuts({ isActive, activeView, onViewChange }: {
  isActive: boolean;
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}) {
  useHomeViewKeyboardShortcuts(isActive, activeView, onViewChange);
  return null;
}
