import React from 'react';
import { BottomSheet } from './BottomSheet';
import { Spinner } from './Spinner';

interface ConfirmSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Body copy explaining the consequence. */
  message: string;
  /** Confirm button label. Defaults to `'Confirm'`. */
  confirmLabel?: string;
  /** Cancel button label. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /**
   * Renders the confirm button in the destructive red style. Use for
   * delete / unsend / block actions. The cancel button is always the
   * neutral `bg-[#2A2A2A]` treatment.
   */
  destructive?: boolean;
  /** In-flight state: shows a spinner inside the confirm button. */
  isProcessing?: boolean;
  /** Spinner label shown while `isProcessing`, e.g. `'Deleting...'`. */
  processingLabel?: string;
  onConfirm: () => void;
}

/**
 * Canonical destructive-action confirmation sheet (docs/PROJECT_REFERENCE.md §13).
 * Replaces the copy-pasted nested locked `BottomSheet` with a
 * `[Cancel | Confirm]` footer that appears in DayViewSheet,
 * CategoryManagerSheet, and ChatPage.
 *
 * Always rendered as a locked sheet over the parent (the parent passes
 * `isLocked` reflecting this sheet's open state). The footer uses
 * plain `<button>` elements rather than the `Button` primitive
 * because the two-button footer has its own layout contract (§13
 * CB-6 → DUP-6).
 */
export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  isOpen,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  isProcessing = false,
  processingLabel,
  onConfirm,
}) => {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title} height="auto">
      <div className="pt-2 pb-8 px-4">
        <p className="text-gray-300 text-sm text-center mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 py-3 bg-[#2A2A2A] rounded-xl text-white font-medium hover:bg-[#333333] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 py-3 rounded-xl text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
              destructive
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            {isProcessing ? (
              <>
                <Spinner size="w-4 h-4" />
                {processingLabel ?? confirmLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
