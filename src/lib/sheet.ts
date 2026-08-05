export type SheetGesture = {
  distance: number;
  velocity: number;
  sheetHeight: number;
};

export function shouldDismissSheet({ distance, velocity, sheetHeight }: SheetGesture): boolean {
  const safeDistance = Math.max(0, distance);
  const distanceThreshold = Math.min(144, Math.max(88, Math.max(0, sheetHeight) * 0.2));

  return safeDistance >= distanceThreshold || (safeDistance >= 36 && Math.max(0, velocity) >= 0.55);
}

export function sheetDragProgress(distance: number, sheetHeight: number): number {
  if (sheetHeight <= 0) return 0;
  return Math.min(1, Math.max(0, distance) / sheetHeight);
}
