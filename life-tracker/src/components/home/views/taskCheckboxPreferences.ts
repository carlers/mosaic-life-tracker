export interface FocusedTaskCheckboxPreferences {
  input: HTMLInputElement;
  rowKey: string | null;
  allowCheckboxes: boolean;
  keepInputFocused: boolean;
}

/** Read the account preferences from the active Day View creation or title-edit input. */
export function getFocusedTaskCheckboxPreferences(): FocusedTaskCheckboxPreferences | null {
  const activeInput = document.activeElement;
  if (!(activeInput instanceof HTMLInputElement) ||
      !activeInput.matches('input[data-task-inline-input]')) {
    return null;
  }
  const scope = activeInput.closest<HTMLElement>('[data-task-checkbox-preferences-scope="true"]');
  return {
    input: activeInput,
    rowKey: activeInput.dataset.taskInlineRowKey || null,
    allowCheckboxes: scope?.dataset.allowTaskCheckboxesWhileAdding !== 'false',
    keepInputFocused: scope?.dataset.keepTaskInputFocusedOnCheckbox !== 'false',
  };
}
