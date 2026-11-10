export interface FocusedTaskCreationCheckboxPreferences {
  allowCheckboxes: boolean;
  keepInputFocused: boolean;
}

/** Read the account preferences from the active Day View's creation-input scope. */
export function getFocusedTaskCreationCheckboxPreferences(): FocusedTaskCreationCheckboxPreferences | null {
  const activeInput = document.activeElement;
  if (!(activeInput instanceof HTMLInputElement) ||
      !activeInput.matches('input[data-task-inline-input][data-task-creation-input]')) {
    return null;
  }
  const scope = activeInput.closest<HTMLElement>('[data-task-checkbox-preferences-scope="true"]');
  return {
    allowCheckboxes: scope?.dataset.allowTaskCheckboxesWhileAdding !== 'false',
    keepInputFocused: scope?.dataset.keepTaskInputFocusedOnCheckbox !== 'false',
  };
}
