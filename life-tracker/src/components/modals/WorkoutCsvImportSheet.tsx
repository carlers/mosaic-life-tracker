import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { importWorkoutRows, type WorkoutSource } from '../../lib/workoutActivity';
import { MosaicSelect } from '../ui/MosaicSelect';
import { MosaicCategorySelect } from '../ui/MosaicCategorySelect';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useCategories';
import { useSettings } from '../../hooks/useSettings';
import { suggestWorkoutCategory } from '../../lib/workoutDayPlacement';
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
  const { categories, addCategory, isLoading: categoriesLoading } = useCategories(isOpen);
  const { getSetting, setSetting } = useSettings();
  const [categoryChoice, setCategoryChoice] = useState('');
  const [fileLabel, setFileLabel] = useState('');
  const [workbook, setWorkbook] = useState<CsvWorkbook | null>(null);
  const [mapping, setMapping] = useState<WorkoutMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<WorkoutSource>('ifttt_strava_csv');
  const [confirmedRights, setConfirmedRights] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
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
    setSaving(false);
    setSource('ifttt_strava_csv');
    setCategoryChoice('');
    setConfirmedRights(false);
    setSaveResult(null);
  };

  useEffect(() => {
    if (!isOpen || previousAccount.current !== user?.$id) {
      generation.current += 1;
      setFileLabel('');
      setWorkbook(null);
      setMapping(null);
      setError(null);
      setLoading(false);
      setSaving(false);
      setSource('ifttt_strava_csv');
      setCategoryChoice('');
      setConfirmedRights(false);
      setSaveResult(null);
    }
    previousAccount.current = user?.$id;
  }, [isOpen, user?.$id]);

  const preview = useMemo(
    () => (workbook && mapping ? previewWorkoutCsv(workbook, mapping) : null),
    [workbook, mapping]
  );
  const sport = preview?.rows.find(row => row.state === 'valid')?.sport ?? '';
  const rememberedCategory = getSetting('defaultWorkoutCategoryId', '');
  const suggestedCategory = useMemo(() => suggestWorkoutCategory(
    categories, sport, typeof rememberedCategory === 'string' ? rememberedCategory : ''
  ), [categories, sport, rememberedCategory]);
  const CREATE_CATEGORY = '__create_private_workout_category__';
  const activeChoice = categoryChoice && (categoryChoice === CREATE_CATEGORY ||
    categories.some(category => category.id === categoryChoice))
    ? categoryChoice : (suggestedCategory?.id ?? CREATE_CATEGORY);
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
    setSource('ifttt_strava_csv');
    setConfirmedRights(false);
    setSaveResult(null);
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
      <div className="space-y-5 px-4 pb-8 pt-3 text-white">
        <div className="flex items-center gap-2 text-xs font-medium text-secondary">
          <ShieldCheck size={15} aria-hidden="true"/>
          CSV preview stays on this device
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">1. Choose file</p>
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
              className="shrink-0 text-emerald-400 underline underline-offset-2"
              onClick={() => {
                const request = ++generation.current;
                clear();
                try {
                  install(SAMPLE, 'Fictional sample');
                  setSource('synthetic');
                  setConfirmedRights(true);
                  generation.current = request + 1;
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : 'Sample unavailable');
                }
              }}
            >Load fictional sample</button>
          </div>

          {loading && <p role="status" className="text-sm text-gray-300">Reading CSV locally…</p>}
          {error && <p role="alert" className="rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{error}</p>}
        </div>

        {workbook && mapping && (
          <>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">2. Check columns</h3>
              {!workbook.detectedHeader && (
                <p role="status" className="text-xs text-amber-200">
                  No recognizable column headings. Choose each column manually.
                </p>
              )}

              {REQUIRED_WORKOUT_COLUMNS.map((column) => (
                <div key={column} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 text-sm">{COLUMN_LABELS[column]}</span>
                  <div className="w-48 min-w-0 shrink-0">
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
                <h3 className="text-sm font-semibold">3. Review workouts</h3>
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
                        <span className={row.state === 'valid' ? 'text-xs text-emerald-400' : 'text-xs text-amber-300'}>
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
              <p className="text-sm font-semibold">4. Save workouts</p>
              <div className="space-y-2">
                <p className="text-xs text-gray-300">Save under category</p>
                <MosaicCategorySelect
                  label="Workout category"
                  value={activeChoice}
                  onChange={setCategoryChoice}
                  options={[
                    ...categories.map(category => ({value: category.id,label: category.name,color:category.color})),
                    {value: CREATE_CATEGORY,label: 'Create private Workout category'},
                  ]}
                  variant="compact"
                />
                {activeChoice === CREATE_CATEGORY &&
                  <p className="text-xs text-secondary">A private Workout category will be created when you save.</p>}
              </div>
              <div className="space-y-2">
                <label htmlFor="workout-source" className="text-xs text-gray-300">Origin of these workout records</label>
                <select id="workout-source"
                  className="mosaic-material-control w-full rounded-xl p-3 text-sm text-white"
                  value={source}
                  onChange={event => { setSource(event.currentTarget.value as WorkoutSource); setConfirmedRights(false); setSaveResult(null); }}
                  disabled={source === 'synthetic' || saving}
                >
                  <option value="ifttt_strava_csv">IFTTT / Strava (preview only)</option>
                  <option value="user_csv">Independent user-owned CSV (local storage allowed)</option>
                  {source === 'synthetic' && <option value="synthetic">Fictional sample (testing)</option>}
                </select>
              </div>
              {source === 'user_csv' && <label className="flex items-start gap-2 text-xs text-gray-300">
                <input type="checkbox" checked={confirmedRights}
                  onChange={event => setConfirmedRights(event.currentTarget.checked)}
                  disabled={saving} />
                I confirm these are independently recorded workouts and I have the right to
                retain this data. This is not an IFTTT/Strava-derived export.
              </label>}
              {source === 'ifttt_strava_csv' && <p className="text-xs text-amber-200">
                The file can be reviewed, but cannot be saved or linked until
                Strava-derived data retention is cleared.
              </p>}
              <Button
                type="button" className="w-full"
                disabled={saving || loading || categoriesLoading || !user?.$id || !preview || preview.valid < 1 ||
                  source === 'ifttt_strava_csv' || (source === 'user_csv' && !confirmedRights)}
                onClick={() => {
                  if (!user?.$id || !preview) return;
                  setSaving(true);
                  setError(null);
                  setSaveResult(null);
                  void (async () => {
                    const categoryId = activeChoice === CREATE_CATEGORY
                      ? await addCategory({
                          name: 'Workout', color: '#FFBE0B',
                          order: categories.reduce((max, category) => Math.max(max, category.order), -1) + 1,
                          visibility: 'private', startedOn: '',
                        })
                      : activeChoice;
                    if (activeChoice === CREATE_CATEGORY) setCategoryChoice(categoryId);
                    const result = await importWorkoutRows(user.$id, preview.rows, source, categoryId);
                    await setSetting('defaultWorkoutCategoryId', categoryId);
                    setCategoryChoice(categoryId);
                    setSaveResult('Saved ' + result.inserted + ' workouts in your category; ' +
                      result.alreadyPresent + ' already present. Include them in your next backup.');
                  })().catch(caught => {
                    setError((caught instanceof Error ? caught.message : 'Workout save failed.') +
                      ' If interrupted, reselect the file: duplicate rows will be skipped.');
                  }).finally(() => setSaving(false));
                }}
              >
                {saving ? 'Saving workouts…' : 'Save ' + (preview?.valid ?? 0) + ' workouts to ' +
                  (activeChoice === CREATE_CATEGORY ? 'new Workout category' :
                    (categories.find(cat => cat.id === activeChoice)?.name ?? 'category'))}
              </Button>
              {saveResult && <p role="status" className="text-sm text-emerald-400">{saveResult}</p>}

              <Button type="button" variant="ghost" onClick={clear} className="w-full">Clear preview</Button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
};

export default WorkoutCsvImportSheet;
