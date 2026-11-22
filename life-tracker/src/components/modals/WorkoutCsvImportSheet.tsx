import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { MosaicSelect } from '../ui/MosaicSelect';
import { useAuth } from '../../hooks/useAuth';
import {
  MAX_WORKOUT_CSV_BYTES,
  REQUIRED_WORKOUT_COLUMNS,
  formatWorkoutPace,
  parseWorkoutCsv,
  previewWorkoutCsv,
  type CsvWorkbook,
  type WorkoutColumn,
  type WorkoutMapping,
} from '../../lib/workoutCsv';

interface WorkoutCsvImportSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE = [
  'Completed At,Activity Type,Name,Distance Meters,Elapsed Time In Seconds',
  '2026-11-18T07:30:00+08:00,Run,"Morning run, easy",5000,1740',
  '2026-11-19T19:45:00+08:00,Run,Evening run,4200,1610',
  '2026-11-19T19:45:00+08:00,Run,Evening run,4200,1610',
  '2026-11-20T06:50:00+08:00,Walk,Short walk,1800,1350',
].join('\n');

const COLUMN_LABELS: Record<WorkoutColumn, string> = {
  completedAt: 'Workout completed at',
  sport: 'Activity type',
  name: 'Workout name',
  distanceMeters: 'Distance (meters)',
  elapsedSeconds: 'Elapsed duration (seconds)',
};

function formSummary(total: number, valid: number, duplicate: number, invalid: number): string {
  return total + ' rows · ' + valid + ' valid · ' + duplicate + ' duplicates · ' + invalid + ' invalid';
}

export const WorkoutCsvImportSheet: React.FC<WorkoutCsvImportSheetProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [fileLabel, setFileLabel] = useState('');
  const [workbook, setWorkbook] = useState<CsvWorkbook | null>(null);
  const [mapping, setMapping] = useState<WorkoutMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const picker = useRef<HTMLInputElement>(null);
  const previousAccount = useRef(user?.$id);

  const clear = () => {
    generation.current += 1;
    setFileLabel('');
    setWorkbook(null);
    setMapping(null);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    if (!isOpen || previousAccount.current !== user?.$id) {
      generation.current += 1;
      setFileLabel('');
      setWorkbook(null);
      setMapping(null);
      setError(null);
      setLoading(false);
    }
    previousAccount.current = user?.$id;
  }, [isOpen, user?.$id]);

  const preview = useMemo(
    () => (workbook && mapping ? previewWorkoutCsv(workbook, mapping) : null),
    [workbook, mapping]
  );
  const mappingReady = mapping !== null &&
    REQUIRED_WORKOUT_COLUMNS.every((column) => mapping[column] !== null) &&
    new Set(REQUIRED_WORKOUT_COLUMNS.map((column) => mapping[column])).size === REQUIRED_WORKOUT_COLUMNS.length;

  const install = (content: string, label: string) => {
    const parsed = parseWorkoutCsv(content);
    setWorkbook(parsed);
    setMapping(parsed.mapping);
    setFileLabel(label);
    setError(null);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const request = ++generation.current;
    setWorkbook(null);
    setMapping(null);
    setError(null);
    setLoading(true);
    if (!/\.csv$/i.test(file.name)) {
      setError('Choose a .csv file exported from a spreadsheet.');
      setLoading(false);
      return;
    }
    if (file.size > MAX_WORKOUT_CSV_BYTES) {
      setError('File exceeds the 8 MiB limit.');
      setLoading(false);
      return;
    }
    try {
      const content = await file.text();
      if (request !== generation.current) return;
      install(content, file.name);
    } catch (caught) {
      if (request !== generation.current) return;
      setError(caught instanceof Error ? caught.message : 'Could not read the CSV file.');
    } finally {
      if (request === generation.current) setLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Import workouts" height="full">
      <div className="space-y-5 px-4 pb-10 pt-3 text-white">
        <div className="mosaic-material-panel rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck size={18} className="text-emerald-400" aria-hidden="true" />
            Private, on-device CSV preview
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-300">
            Choose a CSV from your device. Parsing happens here, without sending your file
            to Strava, IFTTT, Google or Mosaic servers.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-200">
            Preview only. Saving workout history and linking Strava/IFTTT-derived data
            to tasks are unavailable until downstream storage rights and offline-first
            data safeguards are cleared.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">1. Choose a CSV</p>
          <button
            type="button"
            className="mosaic-material-control flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            disabled={loading}
            onClick={() => picker.current?.click()}
          >
            <FileSpreadsheet size={18} aria-hidden="true" />
            Select workout CSV file
          </button>
          <input
            ref={picker}
            className="sr-only"
            tabIndex={-1}
            type="file"
            accept=".csv,text/csv"
            aria-label="Select workout CSV file"
            disabled={loading}
            onChange={(event) => {
              void handleFile(event.currentTarget.files?.[0]);
              // Allow choosing the same CSV again after a failed attempt.
              event.currentTarget.value = '';
            }}
          />
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-gray-400">{fileLabel || 'No file selected'}</span>
            <button
              type="button"
              className="shrink-0 text-emerald-300 underline underline-offset-2"
              onClick={() => {
                const request = ++generation.current;
                clear();
                try {
                  install(SAMPLE, 'Fictional sample (not imported)');
                  generation.current = request + 1;
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : 'Sample unavailable');
                }
              }}
            >Load fictional sample</button>
          </div>
          <p className="text-xs text-gray-400">
            For IFTTT: connect Strava to a private Google Sheet, export the Sheet as CSV,
            then choose the file here. Mosaic does not automatically retrieve spreadsheet rows.
          </p>
          {loading && <p role="status" className="text-sm text-gray-300">Reading CSV locally…</p>}
          {error && <p role="alert" className="rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</p>}
        </div>

        {workbook && mapping && (
          <>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">2. Match columns</h3>
              {!workbook.detectedHeader && (
                <p role="status" className="text-xs text-amber-200">
                  No recognizable column headings. Choose each column manually.
                </p>
              )}
              <p className="text-xs text-gray-400">IFTTT sheets can use custom column orders. Check the mapping before saving any data.</p>
              {REQUIRED_WORKOUT_COLUMNS.map((column) => (
                <div key={column} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 text-sm">{COLUMN_LABELS[column]}</span>
                  <div className="w-40 min-w-0 shrink-0">
                    <MosaicSelect
                      label={COLUMN_LABELS[column]}
                      value={mapping[column] === null ? '' : String(mapping[column])}
                      onChange={(value) => {
                        setMapping((previous) => previous && ({
                          ...previous,
                          [column]: value === '' ? null : Number(value),
                        }));
                      }}
                      options={[
                        { value: '', label: 'Select column' },
                        ...workbook.headers.map((header, index) => ({
                          value: String(index),
                          label: header || ('Column ' + (index + 1)),
                        })),
                      ]}
                      variant="compact"
                    />
                  </div>
                </div>
              ))}
              {!mappingReady && (
                <p role="status" className="text-sm text-amber-200">Select five different CSV columns to preview the workout data.</p>
              )}
            </div>
            {mappingReady && preview && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">3. Review rows</h3>
                <p role="status" className="text-sm text-gray-300">
                  {formSummary(preview.rows.length, preview.valid, preview.duplicate, preview.invalid)}
                </p>
                <div className="space-y-2" aria-label="Workout CSV preview">
                  {preview.rows.slice(0, 12).map((row) => (
                    <div key={row.line} className="mosaic-material-panel rounded-xl border border-white/10 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium">{row.title || 'Untitled workout'}</p>
                          <p className="mt-0.5 text-xs text-gray-400">CSV line {row.line} · {row.sport || 'Unknown sport'} · {row.localDate || 'Unrecognized date'}</p>
                        </div>
                        <span className={row.state === 'valid' ? 'text-xs text-emerald-300' : 'text-xs text-amber-300'}>
                          {row.state}
                        </span>
                      </div>
                      {row.issue ? (
                        <p className="mt-1.5 text-xs text-amber-200">{row.issue}</p>
                      ) : (
                        <p className="mt-1.5 text-xs tabular-nums text-gray-300">
                          {row.distanceMeters === null ? '—' : (row.distanceMeters / 1000).toFixed(2) + ' km'}
                          {' · '}
                          {row.elapsedSeconds === null ? '—' : Math.round(row.elapsedSeconds) + ' sec'}
                          {' · '}
                          {formatWorkoutPace(row.elapsedPaceSecondsPerKm)} elapsed
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {preview.rows.length > 12 && (
                  <p className="text-xs text-gray-400">Showing 12 of {preview.rows.length} checked rows. Counts cover the entire file.</p>
                )}
              </div>
            )}
            <div className="space-y-2 border-t border-white/10 pt-4">
              <Button type="button" disabled className="w-full" title="Requires approved durable storage and source rights">
                Save workouts to Mosaic — unavailable
              </Button>
              <p className="text-center text-xs text-gray-400">
                No activity records, tasks, or account data have been modified.
              </p>
              <Button type="button" variant="ghost" onClick={clear} className="w-full">Clear preview</Button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
};

export default WorkoutCsvImportSheet;
