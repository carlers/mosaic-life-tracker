import { useEffect } from 'react';

export interface SettingsSearchEntry {
  label: string;
  path: string;
  breadcrumb: string;
  keywords?: string;
}

// Each index entry points to a real visible control or category; no personal values or network queries.
export const SETTINGS_SEARCH_ENTRIES: readonly SettingsSearchEntry[] = [
  {
    "label": "Keep adding in same category",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Add new tasks to top",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Confirm individual task deletion",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Show task creation time",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Show task completion time",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Timestamp labels",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Day View display",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Timeline sort by",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Timeline order",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Task completion order",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Incomplete calendar task color",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Shared task labels",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Show pending shared invitations",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Always show Add category in Day View",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Show collapse button for categories",
    "path": "/settings/preferences/tasks",
    "breadcrumb": "Preferences › Tasks & Categories",
    "keywords": ""
  },
  {
    "label": "Open day details as",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": ""
  },
  {
    "label": "Day panel position",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": ""
  },
  {
    "label": "Day panel height",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": ""
  },
  {
    "label": "Days visible on small screens",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": ""
  },
  {
    "label": "Maximum visible tasks per day",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": ""
  },
  {
    "label": "Pinch to change visible days",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": ""
  },
  {
    "label": "Keep weekday header visible",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": "sticky header"
  },
  {
    "label": "Start week on Sunday",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": ""
  },
  {
    "label": "Show Today tag beside date header",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": ""
  },
  {
    "label": "Show holidays",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": ""
  },
  {
    "label": "Holiday region",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": ""
  },
  {
    "label": "Holiday types",
    "path": "/settings/preferences/calendar",
    "breadcrumb": "Preferences › Calendar & Day View",
    "keywords": ""
  },
  {
    "label": "Keyboard shortcuts",
    "path": "/settings/preferences/navigation",
    "breadcrumb": "Preferences › Navigation & Input",
    "keywords": ""
  },
  {
    "label": "View keyboard shortcut guide",
    "path": "/settings/preferences/navigation",
    "breadcrumb": "Preferences › Navigation & Input",
    "keywords": ""
  },
  {
    "label": "Escape navigates back",
    "path": "/settings/preferences/navigation",
    "breadcrumb": "Preferences › Navigation & Input",
    "keywords": ""
  },
  {
    "label": "Appearance",
    "path": "/settings/preferences/appearance",
    "breadcrumb": "Preferences › Appearance & Layout",
    "keywords": ""
  },
  {
    "label": "Reduce animations",
    "path": "/settings/preferences/appearance",
    "breadcrumb": "Preferences › Appearance & Layout",
    "keywords": ""
  },
  {
    "label": "Autoplay GIPHY stickers",
    "path": "/settings/preferences/appearance",
    "breadcrumb": "Preferences › Appearance & Layout",
    "keywords": ""
  },
  {
    "label": "Accent color",
    "path": "/settings/preferences/appearance",
    "breadcrumb": "Preferences › Appearance & Layout",
    "keywords": "color theme palette"
  },
  {
    "label": "UI colors",
    "path": "/settings/preferences/appearance",
    "breadcrumb": "Preferences › Appearance & Layout",
    "keywords": ""
  },
  {
    "label": "Content width",
    "path": "/settings/preferences/appearance",
    "breadcrumb": "Preferences › Appearance & Layout",
    "keywords": ""
  },
  {
    "label": "Bottom sheets",
    "path": "/settings/preferences/appearance",
    "breadcrumb": "Preferences › Appearance & Layout",
    "keywords": ""
  },
  {
    "label": "Show diary in Day View",
    "path": "/settings/preferences/diary",
    "breadcrumb": "Preferences › Diary",
    "keywords": "journal"
  },
  {
    "label": "Diary text",
    "path": "/settings/preferences/diary",
    "breadcrumb": "Preferences › Diary",
    "keywords": ""
  },
  {
    "label": "Default diary position",
    "path": "/settings/preferences/diary",
    "breadcrumb": "Preferences › Diary",
    "keywords": ""
  },
  {
    "label": "Show Diary Today shortcut",
    "path": "/settings/preferences/diary",
    "breadcrumb": "Preferences › Diary",
    "keywords": ""
  },
  {
    "label": "Profile",
    "path": "/settings/account",
    "breadcrumb": "Account",
    "keywords": "avatar name picture edit username"
  },
  {
    "label": "Account email",
    "path": "/settings/account",
    "breadcrumb": "Account",
    "keywords": "email change email login"
  },
  {
    "label": "Change password",
    "path": "/settings/account",
    "breadcrumb": "Account",
    "keywords": "password credentials"
  },
  {
    "label": "Sign Out",
    "path": "/settings/account",
    "breadcrumb": "Account",
    "keywords": "logout log out"
  },
  {
    "label": "Delete Account",
    "path": "/settings/account",
    "breadcrumb": "Account",
    "keywords": "erase permanently"
  },
  {
    "label": "Sync Status",
    "path": "/settings/data",
    "breadcrumb": "Data & Sync",
    "keywords": "sync synchronization offline"
  },
  {
    "label": "Backup & Restore",
    "path": "/settings/data",
    "breadcrumb": "Data & Sync",
    "keywords": "export import save"
  },
  {
    "label": "Import from TodoMate",
    "path": "/settings/data",
    "breadcrumb": "Data & Sync",
    "keywords": "migration"
  },
  {
    "label": "Clear Local Data",
    "path": "/settings/data",
    "breadcrumb": "Data & Sync",
    "keywords": "device offline erase"
  },
  {
    "label": "Version",
    "path": "/settings/about",
    "breadcrumb": "About Mosaic",
    "keywords": "build branch commit backend"
  },
  {
    "label": "Release history",
    "path": "/settings/about",
    "breadcrumb": "About Mosaic",
    "keywords": "changelog updates"
  },
  {
    "label": "Check for Updates",
    "path": "/settings/about",
    "breadcrumb": "About Mosaic",
    "keywords": "update latest"
  },
  {
    "label": "GitHub repository",
    "path": "/settings/about",
    "breadcrumb": "About Mosaic",
    "keywords": "code open source"
  },
  {
    "label": "Notifications",
    "path": "/settings/notifications",
    "breadcrumb": "Notifications",
    "keywords": "alerts push notifications channels"
  }
] as const;

export function searchSettings(query: string): SettingsSearchEntry[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return SETTINGS_SEARCH_ENTRIES.filter((entry) =>
    terms.every((term) => (entry.label + ' ' + entry.breadcrumb + ' ' + (entry.keywords ?? '')).toLocaleLowerCase().includes(term))
  );
}

// Deep links focus an actual control, never toggle or change its saved value.
export function useSettingsTargetFocus(pathname: string, search: string): void {
  useEffect(() => {
    const label = new URLSearchParams(search).get('setting')?.toLocaleLowerCase();
    if (!label) return;
    const frame = requestAnimationFrame(() => {
      const nodes = document.querySelectorAll<HTMLElement>('.mosaic-settings-page [data-setting-label]');
      const node = Array.from(nodes).find((element) =>
        element.dataset.settingLabel?.toLocaleLowerCase().startsWith(label)
      );
      if (!node) return;
      node.scrollIntoView({ block: 'center' });
      const control = node.matches('button, input, select, summary')
        ? node : node.querySelector<HTMLElement>('button, input, select, summary');
      if (control) control.focus({ preventScroll: true });
      else { node.tabIndex = -1; node.focus({ preventScroll: true }); }
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, search]);
}
