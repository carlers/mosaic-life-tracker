import React from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { EyeOff, Users, Globe, Check } from 'lucide-react';
import {
  resolveVisibility,
  isInheriting,
  labelForVisibility,
  type TaskVisibility,
} from '../../../lib/visibility';
import type { TaskDocument, CategoryDocument } from '../../../db/schema';

interface TaskVisibilitySheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDocument | null;
  category: CategoryDocument | null;
  onSave: (visibility: '' | TaskVisibility) => void;
}

const OVERRIDE_OPTIONS: {
  value: TaskVisibility;
  label: string;
  desc: string;
  icon: React.FC<{ size?: number; className?: string }>;
}[] = [
  {
    value: 'private',
    label: 'Private',
    desc: 'Only visible to you',
    icon: EyeOff,
  },
  {
    value: 'followers',
    label: 'Friends',
    desc: 'Visible to your accepted friends',
    icon: Users,
  },
  {
    value: 'public',
    label: 'Public',
    desc: 'Visible to anyone',
    icon: Globe,
  },
];

export const TaskVisibilitySheet: React.FC<TaskVisibilitySheetProps> = ({
  isOpen,
  onClose,
  task,
  category,
  onSave,
}) => {
  if (!task) return null;

  const inheriting = isInheriting(task.visibility);
  const effective = resolveVisibility(task.visibility, category?.visibility);
  const categoryLabel = category?.name || 'this category';
  const inheritedVisibilityLabel = category?.visibility
    ? labelForVisibility(category.visibility as TaskVisibility)
    : 'Private';

  const handleSelect = (value: '' | TaskVisibility) => {
    onSave(value);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Visibility" height="auto">
      <div className="pt-2 pb-8 px-4">
        <p className="text-xs text-gray-500 text-center mb-5 leading-relaxed">
          Control who can see this task on your shared calendar.
        </p>

        {/* Inherit option */}
        <button
          onClick={() => handleSelect('')}
          onPointerDown={(e) => e.stopPropagation()}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors mb-2 ${
            inheriting
              ? 'bg-[#252525] border-emerald-500/50'
              : 'bg-[#1A1A1A] border-[#2A2A2A] hover:bg-[#222222]'
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-[#2A2A2A] flex items-center justify-center flex-shrink-0">
            <Users size={16} className="text-gray-300" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-white">
              Default ({inheritedVisibilityLabel})
            </p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              Follows the &quot;{categoryLabel}&quot; category
            </p>
          </div>
          {inheriting && (
            <Check size={18} className="text-emerald-500 flex-shrink-0" strokeWidth={3} />
          )}
        </button>

        {/* Explicit overrides */}
        {OVERRIDE_OPTIONS.map((opt) => {
          const selected = !inheriting && effective === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              onPointerDown={(e) => e.stopPropagation()}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors mb-2 ${
                selected
                  ? 'bg-[#252525] border-emerald-500/50'
                  : 'bg-[#1A1A1A] border-[#2A2A2A] hover:bg-[#222222]'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-[#2A2A2A] flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-gray-300" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-white">{opt.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
              {selected && (
                <Check size={18} className="text-emerald-500 flex-shrink-0" strokeWidth={3} />
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
};