import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { BottomSheet } from '../components/ui/BottomSheet';
import { TopBar } from '../components/home/TopBar';
import type { ViewType } from '../components/home/ViewSwitcher';
import { Home, Settings, Image as ImageIcon } from 'lucide-react';

export const TestPlayground: React.FC = () => {
  const [text, setText] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  // FIX: Initialize state from localStorage, default to 'calendar'
  const [activeView, setActiveView] = useState<ViewType>(() => {
    return (localStorage.getItem('activeView') as ViewType) || 'calendar';
  });

  // FIX: Save to localStorage whenever view changes
  const handleViewChange = (view: ViewType) => {
    setActiveView(view);
    localStorage.setItem('activeView', view);
  };

  const renderContent = () => {
    return (
      <div className="min-h-full"> {/* Ensure container is tall enough to scroll */}
        
        {/* FIX: TopBar is now sticky internally, no wrapper needed */}
        <TopBar activeView={activeView} onViewChange={handleViewChange} />
        
        <div className="p-6 space-y-6 max-w-md mx-auto">
          
          {/* Active View Indicator */}
          <div className="bg-[#1E1E1E] p-4 rounded-xl border border-[#333333] text-center">
            <p className="text-sm text-gray-400">
              Current Active View: <span className="text-white font-bold uppercase">{activeView}</span>
            </p>
          </div>

          <h1 className="text-2xl font-bold mb-2 text-center">Milestone 2.1 Batch 1 Playground</h1>
          <p className="text-gray-500 text-sm text-center mb-8">
            Verify TopBar, ViewSwitcher animations, and Hamburger Menu sheet.
          </p>

          {/* --- AVATARS --- */}
          <section className="bg-[#1E1E1E] p-4 rounded-xl border border-[#333333]">
            <h2 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">Avatars</h2>
            <div className="flex items-center gap-4">
              <Avatar size="sm" alt="Small" />
              <Avatar size="md" alt="Medium" />
              <Avatar size="lg" alt="Large" />
              <Avatar 
                size="md" 
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100" 
                alt="With Image" 
              />
            </div>
          </section>

          {/* --- BUTTONS --- */}
          <section className="bg-[#1E1E1E] p-4 rounded-xl border border-[#333333]">
            <h2 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">Buttons</h2>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Primary Action</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="danger">Danger Action</Button>
              <Button variant="icon"><Home size={20} /></Button>
              <Button variant="icon"><Settings size={20} /></Button>
              <Button variant="primary" disabled>Disabled</Button>
            </div>
          </section>

          {/* --- INPUTS --- */}
          <section className="bg-[#1E1E1E] p-4 rounded-xl border border-[#333333]">
            <h2 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">Inputs</h2>
            <div className="space-y-4">
              <Input 
                label="Task Title" 
                placeholder="e.g., Buy groceries" 
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <Textarea 
                label="Memo / Notes" 
                placeholder="Add some details here..." 
                rows={3}
              />
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ImageIcon size={14} />
                <span>Image upload would go here</span>
              </div>
            </div>
          </section>

          {/* --- BOTTOM SHEET TEST --- */}
          <section className="bg-[#1E1E1E] p-4 rounded-xl border border-[#333333]">
            <h2 className="text-xs font-semibold text-gray-500 mb-4 uppercase tracking-wider">Bottom Sheet Primitive</h2>
            <p className="text-sm text-gray-400 mb-4">
              Tests spring animation, backdrop click, escape key, and drag-to-close physics.
            </p>
            <Button variant="primary" onClick={() => setIsSheetOpen(true)}>
              Open Test Sheet
            </Button>
          </section>
        </div>

        {/* --- BOTTOM SHEET MODAL --- */}
        <BottomSheet 
          isOpen={isSheetOpen} 
          onClose={() => setIsSheetOpen(false)}
          title="Test Bottom Sheet"
        >
          <div className="space-y-4 pt-2">
            <p className="text-gray-300 text-sm leading-relaxed">
              Try dragging this sheet down to close it! Or click the dark backdrop outside. 
              Pressing Escape on desktop also works.
            </p>
            
            <div className="h-32 bg-[#111111] rounded-lg flex items-center justify-center text-gray-600 text-sm border border-[#333333]">
              Content Block 1
            </div>
            <div className="h-32 bg-[#111111] rounded-lg flex items-center justify-center text-gray-600 text-sm border border-[#333333]">
              Content Block 2
            </div>
            <div className="h-32 bg-[#111111] rounded-lg flex items-center justify-center text-gray-600 text-sm border border-[#333333]">
              Content Block 3 (Scroll me!)
            </div>
            
            <div className="pt-4 border-t border-[#333333]">
               <Button variant="primary" className="w-full" onClick={() => setIsSheetOpen(false)}>
                 Close via Button
               </Button>
            </div>
          </div>
        </BottomSheet>
      </div>
    );
  };

  return renderContent();
};