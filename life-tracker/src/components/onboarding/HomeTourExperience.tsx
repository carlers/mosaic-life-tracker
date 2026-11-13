import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../hooks/authContext';
import { canOfferFirstRunTour, readTourOutcome, recordTourOutcome, tourKey } from '../../lib/tourProgress';

const LazyTourPlayer = React.lazy(() => import('./TourPlayer').then(m => ({ default: m.TourPlayer })));
const LazyTourInvite = React.lazy(() => import('./TourInvite'));

interface HomeTourExperienceProps {
  taskCount: number;
  setActivePersonId: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Non-critical Home onboarding island: loaded after the owner Calendar and
 * collections are usable, never on Home's synchronous startup path. The parent
 * keeps it mounted during replay navigation even when the invite is dismissed.
 */
const HomeTourExperience: React.FC<HomeTourExperienceProps> = ({ taskCount, setActivePersonId }) => {
  const user = React.useContext(AuthContext)?.user ?? null;
  const location = useLocation();
  const navigate = useNavigate();
  const [tourOpen, setTourOpen] = useState(false);
  const [tourInviteDismissed, setTourInviteDismissed] = useState(false);
  const [tourOwner, setTourOwner] = useState<string | null>(null);
  const tourStorageKey = user?.$id ? tourKey(user.$id) : null;
  const tourEligible = Boolean(user &&
    canOfferFirstRunTour(user.$createdAt, taskCount) &&
    tourStorageKey && !readTourOutcome(tourStorageKey));
  const replayRequested = (location.state as { mosaicTourReplay?: boolean } | null)?.mosaicTourReplay === true;

  useEffect(() => {
    if (tourOwner === (user?.$id ?? null)) return;
    queueMicrotask(() => {
      setTourOwner(user?.$id ?? null);
      setTourOpen(false);
      setTourInviteDismissed(false);
    });
  }, [tourOwner, user?.$id]);
  useEffect(() => {
    if (!replayRequested || !user?.$id) return;
    queueMicrotask(() => {
      setTourOpen(true);
      setActivePersonId('me');
      navigate(location.pathname, { replace: true, state: null });
    });
  }, [replayRequested, user?.$id, navigate, location.pathname, setActivePersonId]);

  const finishTour = (outcome: 'skipped' | 'completed') => {
    if (tourStorageKey) recordTourOutcome(tourStorageKey, outcome);
    setTourOpen(false);
    setTourInviteDismissed(true);
  };

  return (
    <>
      {tourEligible && !tourInviteDismissed && !tourOpen && !replayRequested && tourOwner === user?.$id && (
        <React.Suspense fallback={null}>
          <LazyTourInvite
            onSkip={() => { if (tourStorageKey) recordTourOutcome(tourStorageKey, 'skipped'); setTourInviteDismissed(true); }}
            onStart={() => { setActivePersonId('me'); setTourOpen(true); }}
          />
        </React.Suspense>
      )}
      {tourOpen && tourOwner === user?.$id && (
        <React.Suspense fallback={null}>
          <LazyTourPlayer onFinish={finishTour} />
        </React.Suspense>
      )}
    </>
  );
};

export default HomeTourExperience;
