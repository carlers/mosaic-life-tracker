import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { importWorkoutRows, type WorkoutSource, type WorkoutImportEdit } from '../../lib/workoutActivity';
import { MosaicSelect } from '../ui/MosaicSelect';
import { MosaicCategorySelect } from '../ui/MosaicCategorySelect';
import { WorkoutDetailHeader, WorkoutListRow, WorkoutMetrics, workoutDayLabel } from '../ui/WorkoutMetrics';
import { useAuth } from '../../hooks/useAuth';
import { useCategories } from '../../hooks/useCategories';
import { useSettings } from '../../hooks/useSettings';
import { suggestWorkoutCategory } from '../../lib/workoutDayPlacement';
import {
  MAX_WORKOUT_CSV_BYTES,
  REQUIRED_WORKOUT_COLUMNS,
  parseWorkoutCsv,
  previewWorkoutCsv,
  type CsvWorkbook,
  type WorkoutColumn,
  type WorkoutMapping,
  type WorkoutPreviewRow,
} from '../../lib/workoutCsv';

interface WorkoutCsvImportSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const CREATE_CATEGORY = '__create_private_workout_category__';
const PAGE_SIZE = 12;
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

/** Local draft editor: no activity/category writes or source-rights changes here. */
const ImportWorkoutEditor: React.FC<{
  row: WorkoutPreviewRow; edit?: WorkoutImportEdit;
  categoryOptions: { value: string; label: string; color?: string }[];
  defaultCategory: string;
  defaultCategoryColor?: string;
  onApply: (edit: WorkoutImportEdit) => void;
}> = ({row, edit, categoryOptions, defaultCategory, defaultCategoryColor, onApply}) => {
  const [title, setTitle] = useState(edit?.title ?? row.title);
  const [categoryId, setCategoryId] = useState(edit?.categoryId ?? '');
  return <div className="space-y-5 px-4 pb-10 pt-3">
    <WorkoutDetailHeader title={title || 'Untitled workout'} sport={row.sport}/>
    <section className="mosaic-material-panel rounded-2xl border border-border/60 px-4 py-5"
      aria-label="Workout measurements">
      <WorkoutMetrics activity={row} variant="sheet"/>
    </section>
    <p className="text-xs text-secondary">CSV line {row.line} · {row.state === 'valid' ? 'Not saved yet' : row.state}</p>
    {row.issue && <p className="text-sm text-amber-200">{row.issue}</p>}
    {row.state === 'valid' && <section className="space-y-3" aria-label="Edit imported workout">
      <div className="space-y-1.5">
        <label htmlFor="workout-import-title" className="block text-sm font-semibold text-secondary">Title</label>
        <input id="workout-import-title" value={title} maxLength={255}
          onChange={event => setTitle(event.target.value)}
          className="mosaic-material-control w-full rounded-xl px-3 py-3 text-base text-primary"/>
      </div>
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-secondary">Category</label>
        <MosaicCategorySelect label="Imported workout category" value={categoryId}
          onChange={setCategoryId} variant="default" className="w-full"
          options={[
            {value: '', label: 'Use import category (' + defaultCategory + ')', color: defaultCategoryColor},
            ...categoryOptions,
          ]}/>
      </div>
      <Button className="w-full" disabled={!title.trim() || title.trim().length > 255 ||
        (!!categoryId && !categoryOptions.some(option => option.value === categoryId))}
        onClick={() => onApply({title: title.trim(), categoryId: categoryId || undefined})}>
        Apply to preview
      </Button>
      <p className="text-xs text-secondary">Changes are saved only when you confirm the import.</p>
    </section>}
  </div>;
};

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
  const [edits, setEdits] = useState<ReadonlyMap<number, WorkoutImportEdit>>(new Map());
  const [page, setPage] = useState(0);
  const [selectedRow, setSelectedRow] = useState<WorkoutPreviewRow | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editorSession, setEditorSession] = useState(0);
  const resetReview = () => {
    setEdits(new Map());
    setPage(0);
    setSelectedRow(null);
    setDetailsOpen(false);
  };
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
    resetReview();
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
      setEdits(new Map());
      setPage(0);
      setSelectedRow(null);
      setDetailsOpen(false);
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
  const activeChoice = categoryChoice && (categoryChoice === CREATE_CATEGORY ||
    categories.some(category => category.id === categoryChoice))
    ? categoryChoice : (suggestedCategory?.id ?? CREATE_CATEGORY);
  const categoryOptions = useMemo(() => [
    ...categories.filter(category => !category.isDeleted).map(category => ({
      value: category.id, label: category.name, color: category.color,
    })),
    {value: CREATE_CATEGORY, label: 'Create private Workout category'},
  ], [categories]);
  const defaultCategoryName = activeChoice === CREATE_CATEGORY ? 'new Workout category'
    : categories.find(category => category.id === activeChoice)?.name ?? 'category';
  const orderedRows = useMemo(() => [...(preview?.rows ?? [])].sort((a,b) =>
    b.localDate.localeCompare(a.localDate) || b.completedAt.localeCompare(a.completedAt) || a.line - b.line),
  [preview]);
  const pageCount = Math.max(1, Math.ceil(orderedRows.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount - 1);
  const groups = useMemo(() => {
    const dates = new Map<string, WorkoutPreviewRow[]>();
    for (const row of orderedRows.slice(visiblePage * PAGE_SIZE, (visiblePage + 1) * PAGE_SIZE)) {
      const group = dates.get(row.localDate);
      if (group) group.push(row);
      else dates.set(row.localDate, [row]);
    }
    return [...dates.entries()];
  }, [orderedRows, visiblePage]);
  const categoriesById = useMemo(() => new Map(categories.filter(category => !category.isDeleted)
    .map(category => [category.id, category])), [categories]);
  const stagedCategoriesAvailable = [...edits.values()].every(edit =>
    !edit.categoryId || categoryOptions.some(option => option.value === edit.categoryId));
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
    resetReview();
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
    <>
    <BottomSheet isOpen={isOpen} onClose={onClose}
      title="Import workouts" height="auto" pullDownToDismiss preventDismiss={saving}>
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
            disabled={loading || saving}
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
            disabled={loading || saving}
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
              disabled={loading || saving}
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
                      disabled={saving}
                      label={COLUMN_LABELS[column]}
                      value={mapping[column] === null ? '' : String(mapping[column])}
                      onChange={(value) => {
                        resetReview();
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
                <div className="space-y-4" aria-label="Workout CSV preview">
                  {groups.map(([day, rows]) => <section key={day} className="space-y-2" aria-label={workoutDayLabel(day)}>
                    <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-secondary">{workoutDayLabel(day)}</h3>
                    <div className="mosaic-material-panel overflow-hidden rounded-2xl border border-border/60">
                      {rows.map((row,index) => {
                        const edit = edits.get(row.line);
                        const category = categoriesById.get(edit?.categoryId || activeChoice);
                        return <WorkoutListRow key={row.line}
                          title={edit?.title ?? (row.title || 'Untitled workout')}
                          distanceMeters={row.distanceMeters} elapsedSeconds={row.elapsedSeconds}
                          category={category} separated={index > 0} disabled={saving}
                          status={row.state === 'valid' ? undefined : row.state === 'duplicate' ? 'Possible duplicate' : 'Invalid row'}
                          onClick={() => { setSelectedRow(row); setEditorSession(value => value + 1); setDetailsOpen(true); }}/>;
                      })}
                    </div>
                  </section>)}
                </div>
                {pageCount > 1 && <div className="flex items-center justify-between gap-2">
                  <Button variant="ghost" disabled={saving || visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Previous</Button>
                  <span className="text-xs text-secondary">Page {visiblePage + 1} of {pageCount}</span>
                  <Button variant="ghost" disabled={saving || visiblePage + 1 >= pageCount} onClick={() => setPage(visiblePage + 1)}>Next</Button>
                </div>}

              </div>
            )}
            <div className="space-y-2 border-t border-white/10 pt-4">
              <p className="text-sm font-semibold">4. Save workouts</p>
              <div className="space-y-2">
                <p className="text-xs text-gray-300">Default import category</p>
                <MosaicCategorySelect
                  label="Workout category"
                  value={activeChoice}
                  onChange={setCategoryChoice}
                  options={categoryOptions}
                  disabled={saving}
                  variant="compact"
                />
                {edits.size > 0 && <p className="text-xs text-secondary">Individual workout edits override this default.</p>}
                {!stagedCategoriesAvailable && <p role="alert" className="text-xs text-amber-200">A selected category is no longer available. Review the affected workout.</p>}
                {activeChoice === CREATE_CATEGORY &&
                  <p className="text-xs text-secondary">A private Workout category will be created if needed when you save.</p>}
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
                disabled={saving || loading || categoriesLoading || !user?.$id || !mappingReady || !preview || preview.valid < 1 || !stagedCategoriesAvailable ||
                  source === 'ifttt_strava_csv' || (source === 'user_csv' && !confirmedRights)}
                onClick={() => {
                  if (!user?.$id || !preview || !mappingReady || !stagedCategoriesAvailable || saving || source === 'ifttt_strava_csv' || (source === 'user_csv' && !confirmedRights)) return;
                  const request = ++generation.current;
                  setSaving(true);
                  setError(null);
                  setSaveResult(null);
                  void (async () => {
                    const validRows = preview.rows.filter(row => row.state === 'valid');
                    const choices = validRows.map(row => edits.get(row.line)?.categoryId || activeChoice);
                    const needsCategory = choices.includes(CREATE_CATEGORY);
                    const createdId = needsCategory ? await addCategory({
                      name: 'Workout', color: '#FFBE0B',
                      order: categories.reduce((max, category) => Math.max(max, category.order), -1) + 1,
                      visibility: 'private', startedOn: '',
                    }) : '';
                    if (request !== generation.current) return;
                    const resolveCategory = (id: string) => id === CREATE_CATEGORY ? createdId : id;
                    const categoryId = resolveCategory(activeChoice) || resolveCategory(choices[0]);
                    const resolvedEdits = new Map<number, WorkoutImportEdit>();
                    for (const row of validRows) {
                      const edit = edits.get(row.line);
                      if (edit) resolvedEdits.set(row.line, {
                        title: edit.title, categoryId: edit.categoryId ? resolveCategory(edit.categoryId) : undefined,
                      });
                    }
                    // Resolve the create option once so retrying a partially completed
                    // import does not create additional categories.
                    if (createdId) {
                      setEdits(resolvedEdits);
                      if (activeChoice === CREATE_CATEGORY) setCategoryChoice(categoryId);
                    }
                    const result = await importWorkoutRows(user.$id, preview.rows, source, categoryId, resolvedEdits);
                    if (request !== generation.current) return;
                    await setSetting('defaultWorkoutCategoryId', categoryId);
                    if (request !== generation.current) return;
                    setCategoryChoice(categoryId);
                    setSaveResult('Saved ' + result.inserted + ' workouts; ' +
                      result.alreadyPresent + ' already present. Include them in your next backup.');
                  })().catch(caught => {
                    if (request !== generation.current) return;
                    setError((caught instanceof Error ? caught.message : 'Workout save failed.') +
                      ' If interrupted, reselect the file: duplicate rows will be skipped.');
                  }).finally(() => { if (request === generation.current) setSaving(false); });
                }}
              >
                {saving ? 'Saving workouts…' : 'Save ' + (preview?.valid ?? 0) + ' workouts' +
                  ([...edits.values()].some(edit => edit.categoryId) ? ' to selected categories' : ' to ' + defaultCategoryName)}
              </Button>
              {saveResult && <p role="status" className="text-sm text-emerald-400">{saveResult}</p>}

              <Button type="button" variant="ghost" onClick={clear} disabled={saving} className="w-full">Clear preview</Button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
    <BottomSheet isOpen={isOpen && detailsOpen && !!selectedRow} onClose={() => setDetailsOpen(false)}
      onExitComplete={() => { if (!detailsOpen) setSelectedRow(null); }}
      title="Review workout" height="auto" pullDownToDismiss>
      {selectedRow && <ImportWorkoutEditor key={editorSession} row={selectedRow}
        edit={edits.get(selectedRow.line)} categoryOptions={categoryOptions} defaultCategory={defaultCategoryName} defaultCategoryColor={categoriesById.get(activeChoice)?.color}
        onApply={edit => {
          setEdits(previous => new Map(previous).set(selectedRow.line, edit));
          setSaveResult(null);
          setDetailsOpen(false);
        }}/>}
    </BottomSheet>
    </>
  );
};

export default WorkoutCsvImportSheet;
