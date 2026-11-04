import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import '../../src/index.css';

export function ReviewScrollFixture() {
  const stripRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState(0);
  const [overview, setOverview] = useState(true);
  const focus = (index: number) => {
    setActiveStage(index);
    setOverview(false);
  };
  const columns = overview ? 'repeat(3,minmax(0,1fr))' :
    [0,1,2].map(i => i === activeStage ? 'minmax(0,3fr)' : 'minmax(0,1fr)').join(' ');
  return <div data-testid="outer-ancestor" style={{ height: 360 }} className="w-full overflow-x-auto">
    <div style={{ width: 'min(720px, 100%)' }}>
      <Swiper style={{ height: 320 }} noSwipingClass="swiper-no-swiping">
        <SwiperSlide>
          <div className="swiper-no-swiping flex h-full min-h-0 flex-col overflow-hidden px-4 py-3">
            <nav aria-label="Review stage focus" className="mb-3 flex shrink-0 gap-3">
              {['Plan','Execution','Reflection'].map((name,index) =>
                <button type="button" key={name} onClick={() => focus(index)}
                  className="rounded-lg border p-2 text-white" aria-label={'Focus ' + name}>{name}</button>)}
            </nav>
            <div ref={stripRef} data-testid="review-inner-scroller"
              className="grid min-h-0 min-w-0 flex-1 items-start gap-3 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-3"
              style={{ gridTemplateColumns: columns, touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
              {['Plan','Execution','Reflection'].map(name =>
                <section key={name} data-review-stage={name}
                  className="min-w-0 border p-2" style={{ overflowWrap: 'anywhere' }}>
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
