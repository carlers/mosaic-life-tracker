import { preloadHomeRoutePage } from '../components/layout/routePageComponents';

let homePagePromise: Promise<void> | null = null;

/**
 * Returning-account bootstrap and rendered Home use the same prepared
 * component cache. Downloaded JS alone did not prime the route wrapper.
 */
export function preloadHomePage(): Promise<void> {
  homePagePromise ??= preloadHomeRoutePage()
    .then(() => undefined)
    .catch((error) => {
      homePagePromise = null;
      throw error;
    });
  return homePagePromise;
}
