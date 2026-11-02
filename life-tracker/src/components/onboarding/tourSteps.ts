import type { TourStep } from './TourPlayer';

export const CORE_TOUR_STEPS: TourStep[] = [
  { title: 'Find your way around', detail: 'This is your calendar. Change months or switch views to see what is coming up.', target: 'calendar' },
  { title: 'Open a day', detail: 'Tap a date in the calendar to open Day View. This is where you organize tasks for that day.', target: 'calendar' },
  { title: 'Organize and finish tasks', detail: 'In Day View, add tasks to categories, edit them, and mark them complete. You can explore without making any changes.', target: 'dayview' },
  { title: 'Tasks without a date', detail: 'Open the menu to find Backlogs. Keep tasks there until you are ready to schedule them.', target: 'menu' },
  { title: 'Make it yours', detail: 'Explore Settings for preferences. You can replay this tour anytime from Settings → About Mosaic.', target: 'calendar' },
];
