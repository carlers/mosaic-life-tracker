import React from 'react';
import { ViewSwitcher, type ViewType } from './ViewSwitcher';
import { HamburgerMenu } from './HamburgerMenu';

interface TopBarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ activeView, onViewChange }) => {
  return (
    <div className="bg-[#111111] px-4 py-3 border-b border-[#333333]">
      <div className="flex items-center justify-between">
        <ViewSwitcher activeView={activeView} onViewChange={onViewChange} />
        <HamburgerMenu />
      </div>
    </div>
  );
};