import React, { useMemo } from 'react';
import type { CategoryDocument } from '../../db/schema';
import { MosaicSelect, type MosaicSelectOption, type MosaicSelectProps } from './MosaicSelect';

/** Category colors are always visible in option rows and the selected control.
 * This adapter retains the established MosaicSelect keyboard/portal semantics.
 */
export const CategoryColorDot: React.FC<{ color: string; size?: 'sm' | 'md' }> = ({ color, size = 'sm' }) => (
  <span aria-hidden="true" className={'inline-block shrink-0 rounded-full ' +
    (size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5')}
    style={{ backgroundColor: color }} />
);

export type SelectableCategory = Pick<CategoryDocument, 'id' | 'name' | 'color'> &
  Partial<Pick<CategoryDocument, 'isDeleted'>>;

export interface MosaicCategorySelectProps extends Omit<MosaicSelectProps, 'options' | 'showSelectedColor'> {
  /** Pass owner categories when possible; preserve their real palette values. */
  categories?: readonly SelectableCategory[];
  /** For calls with special entries (All, None, Create), may supply prebuilt options. */
  options?: readonly MosaicSelectOption[];
}

/** Reusable category-specific single choice, not a second popup implementation. */
export const MosaicCategorySelect: React.FC<MosaicCategorySelectProps> = ({
  categories, options, ...props
}) => {
  const categoryOptions = useMemo(() => options ??
    (categories ?? []).filter(category => !category.isDeleted).map(category => ({
      value: category.id, label: category.name, color: category.color,
    })), [categories, options]);
  return <MosaicSelect {...props} options={categoryOptions} showSelectedColor />;
};
