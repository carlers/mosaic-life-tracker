export type TaskVisibility = 'private' | 'followers' | 'public';

const VALID: readonly TaskVisibility[] = ['private', 'followers', 'public'];

export function resolveVisibility(
  taskVisibility: string | undefined,
  categoryVisibility: string | undefined
): TaskVisibility {
  if (taskVisibility && (VALID as readonly string[]).includes(taskVisibility)) {
    return taskVisibility as TaskVisibility;
  }
  if (categoryVisibility && (VALID as readonly string[]).includes(categoryVisibility)) {
    return categoryVisibility as TaskVisibility;
  }
  return 'private';
}

export function isInheriting(taskVisibility: string | undefined): boolean {
  return !taskVisibility;
}

export function labelForVisibility(v: TaskVisibility): string {
  switch (v) {
    case 'private':
      return 'Private';
    case 'followers':
      return 'Friends';
    case 'public':
      return 'Public';
  }
}