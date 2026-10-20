import { KeyboardSensor } from '@dnd-kit/dom';
import { isTaskTitleKeyboardTarget } from './useDayViewKeyboardNavigation';

// Retain keyboard dragging on non-task handles, but reserve Enter/Space on
// task title buttons for editing and completion.
export const TASK_REORDER_KEYBOARD_SENSOR = KeyboardSensor.configure({
  preventActivation: event => isTaskTitleKeyboardTarget(event.target),
});
