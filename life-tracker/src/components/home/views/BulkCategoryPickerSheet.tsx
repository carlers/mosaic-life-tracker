import React from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import type { CategoryDocument } from '../../../db/schema';

interface BulkCategoryPickerSheetProps {
  isOpen: boolean;
  count: number;
  categories: readonly CategoryDocument[];
  onClose: () => void;
  onSelect: (categoryId: string) => void;
  isWorking?: boolean;
}

export const BulkCategoryPickerSheet: React.FC<
  BulkCategoryPickerSheetProps
> = ({
  isOpen,
  count,
  categories,
  onClose,
  onSelect,
  isWorking = false,
}) => {
  const availableCategories = React.useMemo(
    () =>
      categories
        .filter((category) => !category.isDeleted)
        .slice()
        .sort(
          (a, b) =>
            (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)
        ),
    [categories]
  );

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Move ${count} ${count === 1 ? 'Task' : 'Tasks'} to Category`}
      height="auto"
      backdropBlur
      preventDismiss={isWorking}
    >
      <div className="space-y-1 px-4 pb-8 pt-2">
        {availableCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            disabled={isWorking}
            onClick={() => onSelect(category.id)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-3.5 text-left text-white transition-colors hover:bg-[#252525] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label={category.name}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-base font-medium">
              {category.name}
            </span>
          </button>
        ))}
        {availableCategories.length === 0 && (
          <p className="px-2 py-4 text-sm text-gray-400">
            No categories available.
          </p>
        )}
      </div>
    </BottomSheet>
  );
};
