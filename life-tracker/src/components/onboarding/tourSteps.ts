import type { TourStep } from './TourPlayer';

export const CORE_TOUR_STEPS: TourStep[] = [
  {
    title: 'Move around your calendar',
    detail: 'Your calendar gives you a quick overview of each day.',
    instruction: 'Try this: tap the left or right arrow to change months.',
    target: 'calendar',
  },
  {
    title: 'Open any day',
    detail: 'Each date opens Day View, where your tasks are organized.',
    instruction: 'Try this: tap the highlighted date. We’ll continue when Day View opens.',
    target: 'date',
  },
  {
    title: 'Plan your day',
    detail: 'Day View is where you can add tasks to categories, edit tasks, and mark them complete. This tour will not change anything for you.',
    instruction: 'Try this: create your first category if prompted, or use + to add a task. You can also just look around.',
    target: 'dayview',
  },
  {
    title: 'Find unscheduled tasks',
    detail: 'Backlogs keeps tasks that do not need a date yet.',
    instruction: 'Try this: close Day View if it is open, then tap the highlighted menu to find Backlogs.',
    target: 'menu',
  },
  {
    title: 'Make Mosaic yours',
    detail: 'Settings contains your preferences and the option to replay this tour whenever you want.',
    instruction: 'Open the menu for Settings, or tap Done to start using Mosaic.',
    target: 'menu',
  },
];
