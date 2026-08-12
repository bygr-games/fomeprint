export type ViewportFittedSize = {
  width: number;
  height: number;
};

const clampViewportDimension = (values: Array<number | undefined>): number => {
  const saneValues = values
    .filter((value): value is number => Number.isFinite(value) && value! > 0)
    .map((value) => Math.floor(value));

  if (saneValues.length === 0) {
    return 1;
  }

  // Use the smallest positive viewport candidate to avoid transient oversized
  // dimensions reported during camera/orientation transitions on mobile.
  return Math.max(1, Math.min(...saneValues));
};

export function getViewportFittedSize(aspectRatio: number): ViewportFittedSize {
  const safeAspectRatio =
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;

  const visualViewport = window.visualViewport;
  const docEl = document.documentElement;

  const viewportWidth = clampViewportDimension([
    window.innerWidth,
    visualViewport?.width,
    docEl?.clientWidth,
  ]);
  const viewportHeight = clampViewportDimension([
    window.innerHeight,
    visualViewport?.height,
    docEl?.clientHeight,
  ]);

  let width = viewportWidth;
  let height = Math.round(width / safeAspectRatio);

  if (height > viewportHeight) {
    height = viewportHeight;
    width = Math.round(height * safeAspectRatio);
  }

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}
