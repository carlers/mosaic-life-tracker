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
  totalSlides: number;
  renderWindow: number;
  handlePrevDay: () => void;
  handleNextDay: () => void;
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

  const [anchorDate] = useState(() => startOfDay(selectedDate));

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
    if (!swiper) return;
    if (swiper.activeIndex === initialIndex) return;
    isProgrammaticMoveRef.current = true;
    swiper.slideTo(initialIndex, 0);
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

  const handleSwipeSettled = useCallback(
    (swiper: SwiperClass) => {
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
    swiperRef.current?.slidePrev();
  }, [isDisabled]);

  const handleNextDay = useCallback(() => {
    if (isDisabled) return;
    swiperRef.current?.slideNext();
  }, [isDisabled]);

  return {
    swiperRef,
    slideDates,
    slideDateStrs,
    activeIndex,
    initialIndex,
    totalSlides: TOTAL_SLIDES,
    renderWindow: RENDER_WINDOW,
    handlePrevDay,
    handleNextDay,
    handleSwipeSettled,
  };
}
