import React from 'react';
import { Eye, EyeOff, Globe, Users } from 'lucide-react';

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

/**
 * Returns the lucide element for a visibility value. Callers own the
 * `size` prop; this helper only fixes the icon identity per value, so
 * every call site renders the same glyph for the same visibility.
 */
export function visibilityIcon(
  v: TaskVisibility,
  size = 12,
  className?: string
): React.ReactElement {
  switch (v) {
    case 'public':
      return React.createElement(Eye, { size, className });
    case 'followers':
      return React.createElement(Users, { size, className });
    case 'private':
      return React.createElement(EyeOff, { size, className });
  }
}

/**
 * Full-name label used by option rows. Distinct from
 * `labelForVisibility` only for 'public' → 'Public' and
 * 'followers' → 'Friends' — kept as a separate export so call sites that
 * want the short label ('Friends') vs the option label can pick.
 */
export function visibilityLabel(v: TaskVisibility): string {
  switch (v) {
    case 'private':
      return 'Private';
    case 'followers':
      return 'Friends';
    case 'public':
      return 'Public';
  }
}

/**
 * Alternative glyph set used by option rows that show a globe for
 * 'public' instead of an eye. Returns the same element shape as
 * `visibilityIcon` so callers can swap freely.
 */
export function visibilityOptionIcon(
  v: TaskVisibility,
  size = 16,
  className?: string
): React.ReactElement {
  switch (v) {
    case 'public':
      return React.createElement(Globe, { size, className });
    case 'followers':
      return React.createElement(Users, { size, className });
    case 'private':
      return React.createElement(EyeOff, { size, className });
  }
}
