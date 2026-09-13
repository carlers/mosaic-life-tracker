import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import { HamburgerMenu } from '../components/home/HamburgerMenu';
import { PersonCarousel } from '../components/home/PersonCarousel';
import { PersonPane } from '../components/home/PersonPane';
import { FriendCarouselSettingsSheet } from '../components/home/FriendCarouselSettingsSheet';
import { useFriendCarousel } from '../hooks/useFriendCarousel';

const RENDER_WINDOW = 1;

export const HomePage: React.FC = () => {
  const {
    persons,
    reorder,
    toggleVisibility,
    resetOrder,
    rawFriends,
    order,
    hidden,
  } = useFriendCarousel();

  const [activePersonId, setActivePersonId] = useState<string>('me');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const swiperRef = useRef<SwiperClass | null>(null);
  const isProgrammaticMoveRef = useRef(false);

  const activeIndex = useMemo(() => {
    const idx = persons.findIndex((p) => p.id === activePersonId);
    return idx >= 0 ? idx : 0;
  }, [persons, activePersonId]);

  useEffect(() => {
    if (persons.length === 0) return;
    const exists = persons.some((p) => p.id === activePersonId);
    if (!exists) setActivePersonId('me');
  }, [persons, activePersonId]);

  useEffect(() => {
    const s = swiperRef.current;
    if (!s) return;
    const idx = persons.findIndex((p) => p.id === activePersonId);
    if (idx < 0) return;
    if (s.activeIndex === idx) return;
    isProgrammaticMoveRef.current = true;
    s.slideTo(idx, 280);
    const raf = requestAnimationFrame(() => {
      isProgrammaticMoveRef.current = false;
    });
    return () => cancelAnimationFrame(raf);
  }, [activePersonId, persons]);

  useEffect(() => {
    const s = swiperRef.current;
    if (!s) return;
    const raf = requestAnimationFrame(() => {
      s.update();
      s.updateSize();
      s.updateSlides();
      const idx = persons.findIndex((p) => p.id === activePersonId);
      if (idx >= 0 && s.activeIndex !== idx) {
        s.slideTo(idx, 0);
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons.length, persons.map((p) => p.id).join('|')]);

  const handleSlideChange = useCallback(
    (s: SwiperClass) => {
      if (isProgrammaticMoveRef.current) return;
      const person = persons[s.activeIndex];
      if (!person) return;
      if (person.id !== activePersonId) setActivePersonId(person.id);
    },
    [persons, activePersonId]
  );

  const handlePillSelect = useCallback(
    (personId: string) => {
      if (personId === activePersonId) return;
      setActivePersonId(personId);
    },
    [activePersonId]
  );

  return (
    <>
      <div className="h-full flex flex-col min-h-0">
        {/* Topmost row: hamburger on the right, no border under it */}
        <div className="bg-[#111111] px-4 pt-3 pb-1 flex justify-end flex-shrink-0">
          <HamburgerMenu />
        </div>

        <div className="flex-shrink-0">
          <PersonCarousel
            persons={persons}
            activePersonId={activePersonId}
            onSelect={handlePillSelect}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>

        <div className="flex-1 min-h-0 relative">
          <Swiper
            onSwiper={(s) => {
              swiperRef.current = s;
            }}
            slidesPerView={1}
            spaceBetween={0}
            speed={280}
            resistanceRatio={0.85}
            threshold={5}
            followFinger
            longSwipes
            longSwipesRatio={0.25}
            longSwipesMs={250}
            shortSwipes
            allowTouchMove={!isSettingsOpen}
            onSlideChange={handleSlideChange}
            observer
            observeParents
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {persons.map((p, i) => (
              <SwiperSlide key={p.id} style={{ height: '100%' }}>
                {Math.abs(i - activeIndex) <= RENDER_WINDOW ? (
                  <PersonPane person={p} isActive={i === activeIndex} />
                ) : null}
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>

      <FriendCarouselSettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        friends={rawFriends}
        order={order}
        hidden={hidden}
        onReorder={reorder}
        onToggleVisibility={toggleVisibility}
        onReset={resetOrder}
      />
    </>
  );
};