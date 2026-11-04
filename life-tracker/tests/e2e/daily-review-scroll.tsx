import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import '../../src/index.css';
import { scrollReviewStripToStage } from '../../src/lib/dailyReviewStageScroll';

export function ReviewScrollFixture() {
  const stripRef = useRef<HTMLDivElement>(null);
  const focus = (index: number) => {
    const strip = stripRef.current;
    const panels = strip?.querySelectorAll<HTMLElement>('[data-review-stage]');
    if (strip && panels?.[0] && panels[index]) scrollReviewStripToStage(strip, panels[0], panels[index]);
  };
  return <div data-testid="outer-ancestor" className="h-[360px] w-full overflow-x-auto">
    <div className="w-[720px]">
      <Swiper className="h-[320px]" noSwipingClass="swiper-no-swiping">
        <SwiperSlide>
          <div className="swiper-no-swiping flex h-full min-h-0 flex-col overflow-hidden px-4 py-3">
            <nav aria-label="Review stage focus" className="mb-3 flex shrink-0 gap-3">
              {['Plan','Execution','Reflection'].map((name,index) =>
                <button type="button" key={name} onClick={() => focus(index)}
                  className="rounded-lg border p-2 text-white" aria-label={'Focus ' + name}>{name}</button>)}
            </nav>
            <div ref={stripRef} data-testid="review-inner-scroller"
              className="flex min-h-0 min-w-0 flex-1 items-start gap-3 overflow-x-auto overflow-y-auto overscroll-contain pb-3">
              {['Plan','Execution','Reflection'].map(name =>
                <section key={name} data-review-stage={name}
                  className="w-[calc(100%-1.25rem)] shrink-0 snap-start border p-4 md:w-auto md:min-w-0 md:shrink md:snap-none">
                  <h3>{name}</h3>
                  {Array.from({length:40}, (_,i) => <p key={i} className="my-2">Tall review content row {i}</p>)}
                </section>)}
            </div>
          </div>
        </SwiperSlide>
        <SwiperSlide><div data-testid="friend-calendar" className="h-full p-6">Friend calendar</div></SwiperSlide>
      </Swiper>
    </div>
  </div>;
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing test root');
createRoot(root).render(<ReviewScrollFixture />);
