export type ViewportFittedSize = {
  width: number;
  height: number;
};

export function getViewportFittedSize(aspectRatio: number): ViewportFittedSize {
  const safeAspectRatio =
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;

  const viewportWidth = Math.max(1, window.innerWidth);
  const viewportHeight = Math.max(1, window.innerHeight);

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
