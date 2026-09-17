import React from 'react';

interface SheetErrorBannerProps {
  message: string | null | undefined;
}

/**
 * Standard error banner for sheets. One implementation of the
 * `bg-red-900/20 border border-red-500/30 text-red-400 text-sm p-3
 * rounded-xl` block that appears in ChangeEmailSheet, ChangePasswordSheet,
 * SetUsernameSheet, ExportDataSheet, and the two image pickers.
 */
export const SheetErrorBanner: React.FC<SheetErrorBannerProps> = ({
  message,
}) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="bg-red-900/20 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl"
    >
      {message}
    </div>
  );
};
