interface OrientationController {
  lock?: (orientation: 'portrait') => Promise<void> | void;
  unlock?: () => void;
}

interface ConfigureOrientationOptions {
  screenWidth?: number;
  screenHeight?: number;
  orientation?: OrientationController;
}

const TABLET_MIN_SHORT_EDGE_PX = 600;

export async function configureResponsiveOrientation({
  screenWidth,
  screenHeight,
  orientation,
}: ConfigureOrientationOptions = {}): Promise<void> {
  if (
    typeof screen === 'undefined' &&
    (screenWidth == null || screenHeight == null)
  ) {
    return;
  }

  const width = screenWidth ?? screen.width;
  const height = screenHeight ?? screen.height;
  const controller =
    orientation ??
    (typeof screen !== 'undefined'
      ? ((screen.orientation as unknown) as OrientationController | undefined)
      : undefined);

  if (!controller) return;

  if (Math.min(width, height) >= TABLET_MIN_SHORT_EDGE_PX) {
    try {
      controller.unlock?.();
    } catch {
      // Screen Orientation support depends on browser/install context.
    }
    return;
  }

  if (!controller.lock) return;
  try {
    await Promise.resolve(controller.lock('portrait'));
  } catch {
    // Phone portrait locking is best-effort in web/PWA contexts.
  }
}
