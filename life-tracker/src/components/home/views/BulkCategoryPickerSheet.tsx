import { BottomSheet } from '../../ui/BottomSheet';
import type { CategoryDocument } from '../../../db/schema';

interface BulkCategoryPickerSheetProps {
  isOpen: boolean;
  categories: readonly CategoryDocument[];
  onClose: () => void;
  onSelect: (categoryId: string) => void;
  isWorking?: boolean;
}

export const BulkCategoryPickerSheet = ({
  isOpen,
  categories,
  onClose,
  onSelect,
  isWorking = false,
}: BulkCategoryPickerSheetProps) => (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Move to Category"
      backdropBlur
      preventDismiss={isWorking}
    >
      <div className="space-y-1 px-4 pb-8 pt-2">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            disabled={isWorking}
            onClick={() => onSelect(category.id)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-3.5 text-left text-white transition-colors hover:bg-[#252525] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="min-w-0 flex-1 truncate text-base font-medium">
              {category.name}
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
);
