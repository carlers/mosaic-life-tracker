import React, { useEffect, type RefObject } from 'react';
import { useKeyboardShortcuts } from '../hooks/keyboardShortcutsContext';
import { registerHomeShortcuts } from './homeShortcutRegistration';

type Props = {
  taskSearchEnabled: boolean;
  isSearchOpen: boolean;
  isSettingsOpen: boolean;
  searchDaySheetOpen: boolean;
  friendCarouselRef: RefObject<HTMLDivElement | null>;
  handleOpenBacklog: () => void;
  handleOpenSearch: () => void;
};

/** Nonvisual, optional Home shortcuts; always mounted inside the keyboard context. */
const HomeKeyboardShortcutBridge: React.FC<Props> = ({
  taskSearchEnabled, isSearchOpen, isSettingsOpen, searchDaySheetOpen,
  friendCarouselRef, handleOpenBacklog, handleOpenSearch,
}) => {
  const { enabled } = useKeyboardShortcuts();
  useEffect(() => {
    if (!enabled || isSearchOpen || isSettingsOpen || searchDaySheetOpen) return;
    return registerHomeShortcuts({
      taskSearchEnabled, friendCarouselRef, handleOpenBacklog, handleOpenSearch,
    });
  }, [enabled, taskSearchEnabled, isSearchOpen, isSettingsOpen,
    searchDaySheetOpen, friendCarouselRef, handleOpenBacklog, handleOpenSearch]);
  return null;
};

export default HomeKeyboardShortcutBridge;
