import React from 'react';
import { createPreparedRoutePage } from './createPreparedRoutePage';
import {
  loadHomePage,
  loadAccountPage,
  loadSettingsPage,
  loadReleaseHistoryPage,
  loadPreferencesPage,
  loadNotificationSettingsPage,
  loadProfilePage,
  loadExplorePage,
  loadMessagesPage,
  loadNotificationsPage,
} from './routeModuleLoaders';

// The real route, its gesture-preview instance and idle importer use one cache.
export const { Component: HomeRoutePage, preload: preloadHomeRoutePage } =
  createPreparedRoutePage(() => loadHomePage().then((m) => m.HomePage));
export const { Component: AccountRoutePage, preload: preloadAccountRoutePage } =
  createPreparedRoutePage(() => loadAccountPage().then((m) => m.AccountPage));
export const { Component: SettingsRoutePage, preload: preloadSettingsRoutePage } =
  createPreparedRoutePage(() => loadSettingsPage().then((m) => m.SettingsPage));
export const { Component: ReleaseHistoryRoutePage, preload: preloadReleaseHistoryRoutePage } =
  createPreparedRoutePage(() => loadReleaseHistoryPage().then((m) => m.ReleaseHistoryPage));
export const { Component: PreferencesRoutePage, preload: preloadPreferencesRoutePage } =
  createPreparedRoutePage(() => loadPreferencesPage().then((m) => m.PreferencesPage));
export const { Component: NotificationSettingsRoutePage, preload: preloadNotificationSettingsRoutePage } =
  createPreparedRoutePage(() => loadNotificationSettingsPage().then((m) => m.NotificationSettingsPage));
export const { Component: ProfileRoutePage, preload: preloadProfileRoutePage } =
  createPreparedRoutePage(() => loadProfilePage().then((m) => m.ProfilePage));
export const { Component: ExploreRoutePage, preload: preloadExploreRoutePage } =
  createPreparedRoutePage(() => loadExplorePage().then((m) => m.ExplorePage));
export const { Component: MessagesRoutePage, preload: preloadMessagesRoutePage } =
  createPreparedRoutePage(() => loadMessagesPage().then((m) => m.MessagesPage));
type NotificationProps = React.ComponentProps<
  (typeof import('../../pages/NotificationsPage'))['NotificationsPage']
>;
export const { Component: NotificationsRoutePage, preload: preloadNotificationsRoutePage } =
  createPreparedRoutePage<NotificationProps>(() => loadNotificationsPage().then((m) => m.NotificationsPage));
