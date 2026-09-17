import React from 'react';
import { Save } from 'lucide-react';
import { Button } from './Button';
import { Spinner } from './Spinner';

interface SheetSaveButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isSaving: boolean;
  label: string;
}

/**
 * Standard "save" footer button for form sheets. Renders a spinner
 * inside the button while `isSaving`, then the Save icon + label.
 * Replaces the copy-pasted Save-button JSX in EditNameSheet,
 * EditDescriptionSheet, ChangeEmailSheet, ChangePasswordSheet, and
 * SetUsernameSheet.
 */
export const SheetSaveButton: React.FC<SheetSaveButtonProps> = ({
  onClick,
  disabled = false,
  isSaving,
  label,
}) => {
  return (
    <Button
      variant="primary"
      className="w-full gap-2 py-3"
      onClick={onClick}
      disabled={disabled || isSaving}
    >
      {isSaving ? (
        <Spinner size="w-4 h-4" />
      ) : (
        <>
          <Save size={18} />
          {label}
        </>
      )}
    </Button>
  );
};
