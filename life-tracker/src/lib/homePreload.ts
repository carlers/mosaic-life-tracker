let homePagePromise: Promise<void> | null = null;

export function preloadHomePage(): Promise<void> {
  homePagePromise ??= import('../pages/HomePage')
    .then(() => undefined)
    .catch((error) => {
      homePagePromise = null;
      throw error;
    });
  return homePagePromise;
}
