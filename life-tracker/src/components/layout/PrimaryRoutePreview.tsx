import React, { memo } from 'react';

type PreviewPath =
  | '/home'
  | '/explore'
  | '/notifications'
  | '/messages'
  | '/account'
  | '/settings';

const LABELS: Record<PreviewPath, string> = {
  '/home': 'Home',
  '/explore': 'Explore',
  '/notifications': 'Alerts',
  '/messages': 'Chat',
  '/account': 'Me',
  '/settings': 'Settings',
};

const ROWS = [0, 1, 2, 3];
const CALENDAR_CELLS = Array.from({ length: 28 }, (_, index) => index);

function isPreviewPath(pathname: string): pathname is PreviewPath {
  return pathname in LABELS;
}

const Header: React.FC<{ title: string }> = ({ title }) => (
  <div className="border-b border-[#333333] bg-[#111111] px-4 py-3">
    <div className="text-lg font-bold text-white">{title}</div>
  </div>
);

const HomeShell = () => (
  <div className="h-full bg-[#111111] text-white">
    <div className="flex h-14 items-center justify-end px-4">
      <div className="flex h-9 w-9 flex-col items-center justify-center gap-1 rounded-lg border border-[#333333] bg-[#1E1E1E]">
        <span className="h-0.5 w-4 rounded bg-gray-400" />
        <span className="h-0.5 w-4 rounded bg-gray-400" />
        <span className="h-0.5 w-4 rounded bg-gray-400" />
      </div>
    </div>
    <div className="flex gap-2 px-3 py-2">
      <div className="h-9 w-20 rounded-full bg-white" />
      <div className="h-9 w-24 rounded-full border border-[#333333] bg-[#1E1E1E]" />
      <div className="h-9 w-9 rounded-full border border-[#333333] bg-[#1E1E1E]" />
    </div>
    <div className="mt-4 flex items-center justify-between border-b border-[#333333] px-4 pb-3">
      <div className="h-8 w-28 rounded-lg bg-[#1E1E1E]" />
      <div className="h-6 w-28 rounded bg-[#1E1E1E]" />
      <div className="flex gap-2">
        <div className="h-9 w-9 rounded-lg bg-[#1E1E1E]" />
        <div className="h-9 w-9 rounded-lg bg-[#1E1E1E]" />
      </div>
    </div>
    <div className="grid grid-cols-7 gap-y-4 px-4 pt-5">
      {CALENDAR_CELLS.map((cell) => (
        <div key={cell} className="flex justify-center">
          <div className="h-7 w-7 rounded-full bg-[#2A2A2A]" />
        </div>
      ))}
    </div>
  </div>
);

const ExploreShell = () => (
  <div className="h-full bg-[#111111] text-white">
    <Header title="Explore" />
    <div className="space-y-5 px-4 py-4">
      <div className="h-11 rounded-xl border border-[#333333] bg-[#1E1E1E]" />
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-[#333333]" />
        {ROWS.slice(0, 3).map((row) => (
          <div key={row} className="h-14 rounded-xl border border-[#333333] bg-[#1E1E1E]" />
        ))}
      </div>
      <div className="h-20 rounded-xl border border-[#333333] bg-[#1E1E1E]" />
    </div>
  </div>
);

const NotificationsShell = () => (
  <div className="flex h-full flex-col bg-[#111111] text-white">
    <Header title="Alerts" />
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <div className="h-16 w-16 rounded-full border border-[#333333] bg-[#1E1E1E]" />
      <div className="h-5 w-28 rounded bg-[#2A2A2A]" />
      <div className="h-3 w-44 rounded bg-[#1E1E1E]" />
    </div>
  </div>
);

const MessagesShell = () => (
  <div className="h-full bg-[#111111] text-white">
    <Header title="Messages" />
    <div className="space-y-2 px-4 py-4">
      {ROWS.map((row) => (
        <div key={row} className="flex items-center gap-3 rounded-xl py-2">
          <div className="h-11 w-11 rounded-full bg-[#2A2A2A]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 rounded bg-[#2A2A2A]" />
            <div className="h-3 w-44 max-w-full rounded bg-[#1E1E1E]" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const AccountShell = () => (
  <div className="h-full bg-[#111111] text-white">
    <Header title="Me" />
    <div className="space-y-5 px-4 py-5">
      <div className="flex flex-col items-center gap-3">
        <div className="h-20 w-20 rounded-full bg-[#2A2A2A]" />
        <div className="h-5 w-28 rounded bg-[#2A2A2A]" />
        <div className="h-3 w-40 rounded bg-[#1E1E1E]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-xl border border-[#333333] bg-[#1E1E1E]" />
        <div className="h-20 rounded-xl border border-[#333333] bg-[#1E1E1E]" />
      </div>
      <div className="h-20 rounded-xl border border-[#333333] bg-[#1E1E1E]" />
      <div className="h-20 rounded-xl border border-[#333333] bg-[#1E1E1E]" />
    </div>
  </div>
);

const SettingsShell = () => (
  <div className="h-full bg-[#111111] text-white">
    <Header title="Settings" />
    <div className="divide-y divide-[#333333]">
      {Array.from({ length: 8 }, (_, row) => (
        <div key={row} className="flex h-12 items-center gap-3 px-4">
          <div className="h-5 w-5 rounded bg-[#2A2A2A]" />
          <div className="h-3 w-28 rounded bg-[#2A2A2A]" />
        </div>
      ))}
    </div>
  </div>
);

const PrimaryRoutePreviewComponent: React.FC<{ pathname: string }> = ({
  pathname,
}) => {
  if (!isPreviewPath(pathname)) return null;

  switch (pathname) {
    case '/home':
      return <HomeShell />;
    case '/explore':
      return <ExploreShell />;
    case '/notifications':
      return <NotificationsShell />;
    case '/messages':
      return <MessagesShell />;
    case '/account':
      return <AccountShell />;
    case '/settings':
      return <SettingsShell />;
  }
};

export const PrimaryRoutePreview = memo(PrimaryRoutePreviewComponent);
PrimaryRoutePreview.displayName = 'PrimaryRoutePreview';
