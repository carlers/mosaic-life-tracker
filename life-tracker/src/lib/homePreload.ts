type HomePageComponent = (typeof import('../pages/HomePage'))['HomePage'];
let homePagePromise: Promise<void> | null = null;
let loadedHomePage: HomePageComponent | null = null;
const listeners = new Set<() => void>();

export function getLoadedHomePage(): HomePageComponent | null {
  return loadedHomePage;
}

export function subscribeLoadedHomePage(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function preloadHomePage(): Promise<void> {
  homePagePromise ??= import('../pages/HomePage')
    .then((module) => {
      loadedHomePage = module.HomePage;
      for (const listener of listeners) listener();
    })
    .catch((error) => {
      homePagePromise = null;
      throw error;
    });
  return homePagePromise;
}
