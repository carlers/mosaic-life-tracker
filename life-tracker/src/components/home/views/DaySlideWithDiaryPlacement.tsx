import React, { useCallback, useMemo } from 'react';
import { DaySlide } from './DaySlide';
import type { DaySlideProps } from './DaySlideContent';
import { diaryPlacementKey, normalizeDiaryPlacement, type DiaryPlacement } from '../../../lib/diaryPlacement';

/**
 * Keep per-date diary action and placement references stable across unrelated
 * parent sheet state updates. Unlike a custom React.memo comparator, this
 * still forwards real settings, task and callback changes.
 */
type Props = Omit<DaySlideProps, 'diaryPlacement' | 'onMoveDiary'> & {
  savedDiaryPlacement: unknown;
  diaryPosition: 'top' | 'bottom';
  setDiaryPlacement: (key: string, value: unknown) => Promise<void>;
};

export const DaySlideWithDiaryPlacement = React.memo(function DaySlideWithDiaryPlacement({
  dateStr,
  savedDiaryPlacement,
  diaryPosition,
  setDiaryPlacement,
  ...slideProps
}: Props) {
  const placement = useMemo(
    () => normalizeDiaryPlacement(savedDiaryPlacement, diaryPosition),
    [savedDiaryPlacement, diaryPosition],
  );
  const onMoveDiary = useCallback(
    (next: DiaryPlacement) => setDiaryPlacement(diaryPlacementKey(dateStr), next),
    [dateStr, setDiaryPlacement],
  );

  return (
    <DaySlide
      {...slideProps}
      dateStr={dateStr}
      diaryPlacement={placement}
      onMoveDiary={onMoveDiary}
    />
  );
});
