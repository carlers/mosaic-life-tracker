import React, { useState } from 'react';
import { ExploreView } from '../components/explore/ExploreView';
import { SetUsernameSheet } from '../components/modals/SetUsernameSheet';

export const ExplorePage: React.FC = () => {
  const [isUsernameSheetOpen, setIsUsernameSheetOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  return (
    <>
      <ExploreView
        onRequestUsername={() => setIsUsernameSheetOpen(true)}
        onFeedback={showFeedback}
      />

      <SetUsernameSheet
        isOpen={isUsernameSheetOpen}
        onClose={() => setIsUsernameSheetOpen(false)}
        onSuccess={(username) => showFeedback(`Profile saved as @${username}`)}
      />

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] border border-[#444444] text-white text-sm px-5 py-2.5 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {feedback}
        </div>
      )}
    </>
  );
};
