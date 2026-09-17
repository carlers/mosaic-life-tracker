import React from 'react';

interface SpinnerProps {
  /**
   * Tailwind size class applied to width and height, e.g. `w-4 h-4`.
   * Defaults to `w-6 h-6` (the loading-state size used across sheets
   * and pages).
   */
  size?: string;
  /** Border color class. Defaults to `border-white`. */
  color?: string;
  /** Extra classes merged onto the spinner div. */
  className?: string;
}

/**
 * The canonical inline spinner markup (AGENTS §14). Replaces the
 * copy-pasted `<div className="w-N h-N border-2 border-white
 * border-t-transparent rounded-full animate-spin" />` that appears
 * across sheets, pages, and buttons.
 *
 * Default size `w-6 h-6` matches the loading states; pass `size="w-4
 * h-4"` for in-button spinners and `size="w-8 h-8"` for page-level
 * spinners.
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'w-6 h-6',
  color = 'border-white',
  className = '',
}) => {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${size} border-2 ${color} border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
};
