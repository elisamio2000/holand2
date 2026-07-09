export const BOARD_GRID_SIZE = 24;

export function snapCoord(value: number, enabled: boolean, grid = BOARD_GRID_SIZE): number {
  if (!enabled || grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function snapPoint(
  x: number,
  y: number,
  enabled: boolean,
  grid = BOARD_GRID_SIZE
): { x: number; y: number } {
  return { x: snapCoord(x, enabled, grid), y: snapCoord(y, enabled, grid) };
}
