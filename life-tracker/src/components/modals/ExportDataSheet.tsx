import React, { useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { SheetErrorBanner } from '../ui/SheetErrorBanner';
import { Spinner } from '../ui/Spinner';
import { useSheetReset } from '../../hooks/useSheetReset';
import { FileDown, Loader2, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { exportUserData, triggerDownload } from '../../lib/exportData';

interface ExportDataSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const ExportDataSheet: React.FC<ExportDataSheetProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [includeImages, setIncludeImages] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useSheetReset(isOpen, () => {
    setIncludeImages(false);
    setIsExporting(false);
    setProgressText('');
    setError(null);
  });

  const handleExport = async () => {
    if (!user || isExporting) return;
    setIsExporting(true);
    setError(null);
    setProgressText('Preparing…');
    try {
      const result = await exportUserData(
        { id: user.$id, email: user.email, name: user.name || '' },
        {
          includeImages,
          onProgress: (msg) => setProgressText(msg),
        }
      );
      triggerDownload(result.blob, result.filename);
      setIsExporting(false);
      const missing = result.counts.missingImages;
      if (missing > 0) {
        onSuccess?.(
          `Export ready (${missing} photo${
            missing === 1 ? '' : 's'
          } couldn't be fetched — re-export online to include them)`
        );
      } else {
        onSuccess?.('Export ready');
      }
      onClose();
    } catch (err) {
      console.error('[ExportDataSheet] Export failed:', err);
      setError(
        err instanceof Error ? err.message : 'Export failed. Please try again.'
      );
      setIsExporting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Export Data" height="auto">
      <div className="pt-2 pb-8 px-4 space-y-4">
        <p className="text-sm text-gray-400 text-center leading-relaxed">
          Download a copy of your tasks, categories, diary, and settings. This file
          contains your personal data — store it safely.
        </p>

        <SheetErrorBanner message={error} />

        <button
          type="button"
          onClick={() => setIncludeImages(!includeImages)}
          disabled={isExporting}
          className="w-full flex items-center justify-between gap-3 bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 hover:bg-[#222222] transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <ImageIcon size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Include photos</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Larger ZIP file. Requires internet for uncached photos.
              </p>
            </div>
          </div>
          <div
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              includeImages ? 'bg-emerald-500' : 'bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                includeImages ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </div>
        </button>

        {isExporting && progressText && (
          <div className="flex items-center gap-3 px-2 py-1">
            <Spinner size="w-4 h-4" className="flex-shrink-0" />
            <span className="text-sm text-gray-300">{progressText}</span>
          </div>
        )}

        <Button
          variant="primary"
          className="w-full gap-2 py-3"
          onClick={handleExport}
          disabled={isExporting || !user}
        >
          {isExporting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Exporting…
            </>
          ) : (
            <>
              <FileDown size={18} />
              Export
            </>
          )}
        </Button>
      </div>
    </BottomSheet>
  );
};
