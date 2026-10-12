import React from 'react';
import { createPreloadedLazy } from '../../lib/createPreloadedLazy';
import type { FriendDayViewSheet } from './FriendDayViewSheet';

const { Component, preload } = createPreloadedLazy<
  React.ComponentProps<typeof FriendDayViewSheet>
>(() => import('./FriendDayViewSheet').then(m => m.FriendDayViewSheet));

export const LazyFriendDayViewSheet = Component;
export const preloadFriendDayViewSheet = preload;
