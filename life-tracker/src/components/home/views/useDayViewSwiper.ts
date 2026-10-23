import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import type { Swiper as SwiperClass } from 'swiper';

export const TOTAL_SLIDES = 181;
export const RENDER_WINDOW = 3;

const CENTER_INDEX = (TOTAL_SLIDES - 1) / 2;

interface UseDayViewSwiperOptions {
  isOpen: boolean;
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
  isDisabled: boolean;
}

interface UseDayViewSwiperReturn {
  swiperRef: React.MutableRefObject<SwiperClass | null>;
  slideDates: Date[];
  slideDateStrs: string[];
  activeIndex: number;
  initialIndex: number;
  anchorKey: string;
  totalSlides: number;
  renderWindow: number;
  handlePrevDay: () => void;
  handleNextDay: () => void;
  handleSlideChange: (swiper: SwiperClass) => void;
  handleSwipeSettled: (swiper: SwiperClass) => void;
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function useDayViewSwiper({
  isOpen,
  selectedDate,
  onDateChange,
  isDisabled,
}: UseDayViewSwiperOptions): UseDayViewSwiperReturn {
  const swiperRef = useRef<SwiperClass | null>(null);
  const isProgrammaticMoveRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [anchorDate, setAnchorDate] = useState(() => startOfDay(selectedDate));
  // The 181-day window must follow date selection beyond its initial ±90
  // days. Rebase before exhausting the neighbor buffer, but keep the anchor
  // stable for ordinary date changes so short swipes never remount Swiper.
  const selectedDay = startOfDay(selectedDate);
  const distanceFromAnchor = differenceInCalendarDays(selectedDay, anchorDate);
  if (Math.abs(distanceFromAnchor) >= CENTER_INDEX - RENDER_WINDOW) {
    setAnchorDate(selectedDay);
  }
  const anchorKey = formatDateStr(anchorDate);

  const slideDates = useMemo(() => {
    const dates: Date[] = [];
    const start = addDays(anchorDate, -CENTER_INDEX);
    for (let i = 0; i < TOTAL_SLIDES; i++) {
      dates.push(addDays(start, i));
    }
    return dates;
  }, [anchorDate]);

  const slideDateStrs = useMemo(
    () => slideDates.map(formatDateStr),
    [slideDates]
  );

  const initialIndex = useMemo(() => {
    const diff = differenceInCalendarDays(
      startOfDay(selectedDate),
      anchorDate
    );
    return Math.min(Math.max(CENTER_INDEX + diff, 0), TOTAL_SLIDES - 1);
  }, [selectedDate, anchorDate]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [syncedInitialIndex, setSyncedInitialIndex] = useState(initialIndex);

  if (initialIndex !== syncedInitialIndex) {
    setSyncedInitialIndex(initialIndex);
    setActiveIndex(initialIndex);
  }

  useEffect(() => {
    if (!isOpen) return;
    const swiper = swiperRef.current;
    if (!swiper || swiper.destroyed) return;
    if (swiper.activeIndex === initialIndex) return;

    isProgrammaticMoveRef.current = true;

    // Keep 181 logical dates, but only nearby Swiper DOM slides in sheet mode.
    // On date jumps, explicitly refresh Virtual's DOM window as well as the
    // selected index; the seven-day task render buffer follows separately.
    swiper.slideTo(initialIndex, 0);
    // React Swiper virtual can retain a stale DOM window after a large date
    // jump; force that small window to the newly selected logical index.
    swiper.virtual?.update?.(true, false, initialIndex);
    swiper.updateSlides?.();

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      isProgrammaticMoveRef.current = false;
    });
  }, [isOpen, initialIndex]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const handleSlideChange = useCallback((swiper: SwiperClass) => {
    // Keep the render window tracking Swiper immediately so rapid consecutive
    // swipes never outrun the prepared neighboring DaySlides.
    setActiveIndex(swiper.activeIndex);
  }, []);

  const handleSwipeSettled = useCallback(
    (swiper: SwiperClass) => {
      // Parent date propagation waits until the snap completes. The local
      // active index already moved on slideChange, keeping the buffer ready.
      setActiveIndex(swiper.activeIndex);
      if (isProgrammaticMoveRef.current) return;
      const date = slideDates[swiper.activeIndex];
      if (date && onDateChange) {
        onDateChange(date);
      }
    },
    [slideDates, onDateChange]
  );

  const handlePrevDay = useCallback(() => {
    if (isDisabled) return;
    const swiper = swiperRef.current;
    if (!swiper || swiper.destroyed) return;
    swiper.slidePrev();
  }, [isDisabled]);

  const handleNextDay = useCallback(() => {
    if (isDisabled) return;
    const swiper = swiperRef.current;
    if (!swiper || swiper.destroyed) return;
    swiper.slideNext();
  }, [isDisabled]);

  return {
    swiperRef,
    slideDates,
    slideDateStrs,
    activeIndex,
    initialIndex,
    anchorKey,
    totalSlides: TOTAL_SLIDES,
    renderWindow: RENDER_WINDOW,
    handlePrevDay,
    handleNextDay,
    handleSlideChange,
    handleSwipeSettled,
  };
}
