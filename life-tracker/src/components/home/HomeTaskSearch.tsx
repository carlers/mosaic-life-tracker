import React, {
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { format, parseISO } from 'date-fns';
import { motion, useReducedMotion } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Search,
  X,
} from 'lucide-react';
import {
  filterAndRankTasks,
  hasTaskSearchCriteria,
  type TaskSearchDateFilter,
} from '../../lib/taskSearch';
import type { CategoryDocument, TaskDocument } from '../../db/schema';

interface HomeTaskSearchProps {
  isOpen: boolean;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  isLoading?: boolean;
  now?: Date;
  onOpen: () => void;
  onClose: () => void;
  onSelectTask: (task: TaskDocument) => void;
  trailing: ReactNode;
}

const RESULT_LIMIT = 50;

const DATE_FILTERS: Array<{
  value: TaskSearchDateFilter;
  label: string;
}> = [
  { value: 'any', label: 'Any date' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

function taskDateLabel(date: string): string {
  return format(parseISO(date), 'EEE, MMM d, yyyy');
}

export const HomeTaskSearch: React.FC<HomeTaskSearchProps> = ({
  isOpen,
  tasks,
  categories,
  isLoading = false,
  now,
  onOpen,
  onClose,
  onSelectTask,
  trailing,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    () => new Set()
  );
  const [dateFilter, setDateFilter] =
    useState<TaskSearchDateFilter>('any');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const deferredQuery = useDeferredValue(query);

  const categoryIds = useMemo(
    () => Array.from(selectedCategoryIds),
    [selectedCategoryIds]
  );
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const searchOptions = useMemo(
    () => ({
      query: deferredQuery,
      categoryIds,
      dateFilter,
      customStart,
      customEnd,
      now,
      limit: RESULT_LIMIT,
    }),
    [
      deferredQuery,
      categoryIds,
      dateFilter,
      customStart,
      customEnd,
      now,
    ]
  );
  const hasCriteria = hasTaskSearchCriteria(searchOptions);
  const searchOutput = useMemo(
    () =>
      hasCriteria
        ? filterAndRankTasks(tasks, searchOptions)
        : { results: [], total: 0 },
    [hasCriteria, searchOptions, tasks]
  );

  const resetSearch = () => {
    setQuery('');
    setSelectedCategoryIds(new Set());
    setDateFilter('any');
    setCustomStart('');
    setCustomEnd('');
  };

  const handleClose = () => {
    resetSearch();
    onClose();
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const clearCategories = () => {
    setSelectedCategoryIds(new Set());
  };

  const hasActiveFilter =
    selectedCategoryIds.size > 0 ||
    dateFilter !== 'any' ||
    Boolean(customStart || customEnd);

  return (
    <div
      data-route-swipe-zone="home-to-explore"
      className="relative z-40 flex-shrink-0 bg-[#111111] px-4 pt-3 pb-1 touch-pan-y"
    >
      <div className="flex items-center justify-end gap-2">
        {isOpen ? (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: 'easeOut' }}
            data-route-swipe-ignore="true"
            className="min-w-0 flex-1"
          >
            <div className="relative flex min-w-0 items-center">
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 text-gray-400"
              />
              <input
                autoFocus
                type="search"
                role="searchbox"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') handleClose();
                }}
                placeholder="Search my tasks…"
                aria-label="Search my tasks"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-xl border border-[#333333] bg-[#1E1E1E] py-2 pl-10 pr-10 text-sm text-white outline-none placeholder:text-gray-500 focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              />
              <button
                type="button"
                onClick={handleClose}
                className="absolute right-2 rounded-lg p-1.5 text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                aria-label="Close task search"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        ) : (
          <div data-route-swipe-ignore="true" className="shrink-0">
            <button
              type="button"
              onClick={onOpen}
              className="rounded-lg border border-[#333333] bg-[#1E1E1E] p-2 text-gray-400 transition-colors hover:bg-[#2A2A2A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              aria-label="Search tasks"
            >
              <Search size={20} aria-hidden="true" />
            </button>
          </div>
        )}

        <div data-route-swipe-ignore="true" className="shrink-0">
          {trailing}
        </div>
      </div>

      {isOpen && (
        <motion.div
          data-route-swipe-ignore="true"
          initial={
            shouldReduceMotion ? false : { opacity: 0, y: -4 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.16 }}
          className="absolute left-4 right-4 top-full z-50 pt-2"
        >
          <div className="max-h-[min(72dvh,42rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[#333333] bg-[#181818] shadow-2xl">
            <div className="border-b border-[#2A2A2A] px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Categories
                </span>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={resetSearch}
                    className="rounded px-2 py-1 text-xs text-gray-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  aria-pressed={selectedCategoryIds.size === 0}
                  onClick={clearCategories}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                    selectedCategoryIds.size === 0
                      ? 'border-white/30 bg-white/10 text-white'
                      : 'border-[#333333] text-gray-400'
                  }`}
                >
                  All categories
                </button>
                {categories.map((category) => {
                  const selected = selectedCategoryIds.has(category.id);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleCategory(category.id)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                        selected
                          ? 'border-white/30 bg-white/10 text-white'
                          : 'border-[#333333] text-gray-400'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {DATE_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={dateFilter === filter.value}
                    onClick={() => setDateFilter(filter.value)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
                      dateFilter === filter.value
                        ? 'border-white/30 bg-white/10 text-white'
                        : 'border-[#333333] text-gray-400'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {dateFilter === 'custom' && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-400">
                    <span className="mb-1 block">From</span>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(event) => setCustomStart(event.target.value)}
                      aria-label="Start date"
                      className="w-full rounded-lg border border-[#333333] bg-[#111111] px-2 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                    />
                  </label>
                  <label className="text-xs text-gray-400">
                    <span className="mb-1 block">To</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(event) => setCustomEnd(event.target.value)}
                      aria-label="End date"
                      className="w-full rounded-lg border border-[#333333] bg-[#111111] px-2 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="px-2 py-2">
              {isLoading ? (
                <div
                  role="status"
                  className="px-3 py-8 text-center text-sm text-gray-400"
                >
                  Loading tasks…
                </div>
              ) : !hasCriteria ? (
                <div className="px-3 py-8 text-center text-sm text-gray-400">
                  Search by task title or choose a filter.
                </div>
              ) : searchOutput.total === 0 ? (
                <div
                  role="status"
                  className="px-3 py-8 text-center text-sm text-gray-400"
                >
                  No matching tasks.
                </div>
              ) : (
                <>
                  <div
                    aria-live="polite"
                    className="px-2 pb-2 text-xs text-gray-500"
                  >
                    {searchOutput.total > searchOutput.results.length
                      ? `Showing ${searchOutput.results.length} of ${searchOutput.total} matches`
                      : `${searchOutput.total} ${
                          searchOutput.total === 1 ? 'match' : 'matches'
                        }`}
                  </div>
                  <div>
                    {searchOutput.results.map((task) => {
                      const category = categoryById.get(task.categoryId);
                      const dateLabel = taskDateLabel(task.date);
                      return (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => onSelectTask(task)}
                          aria-label={`Open task ${task.title} on ${dateLabel}`}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: category?.color ?? '#6B7280',
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start gap-2">
                              <span
                                className={`min-w-0 flex-1 break-words text-sm ${
                                  task.completed
                                    ? 'text-gray-400 line-through'
                                    : 'text-white'
                                }`}
                              >
                                {task.title}
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5 text-gray-500">
                                {task.completed && (
                                  <span role="img" aria-label="Completed">
                                    <CheckCircle2
                                      size={15}
                                      aria-hidden="true"
                                    />
                                  </span>
                                )}
                                {task.memo?.trim() && (
                                  <span
                                    role="img"
                                    aria-label="Has memo"
                                    title="Has memo"
                                  >
                                    <FileText size={15} aria-hidden="true" />
                                  </span>
                                )}
                                {task.image && (
                                  <span
                                    role="img"
                                    aria-label="Has image"
                                    title="Has image"
                                  >
                                    <ImageIcon size={15} aria-hidden="true" />
                                  </span>
                                )}
                              </span>
                            </span>
                            <span className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                              <span>{category?.name ?? 'Uncategorized'}</span>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays size={12} aria-hidden="true" />
                                {dateLabel}
                              </span>
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
