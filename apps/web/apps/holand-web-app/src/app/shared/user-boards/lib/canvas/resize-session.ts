export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export const MIN_OBJECT_WIDTH = 80;
export const MIN_OBJECT_HEIGHT = 56;

/** Sticky header needs room for label + ink tools without overflow */
export const MIN_STICKY_WIDTH = 152;
export const MIN_STICKY_HEIGHT = 104;

export function getObjectMinSize(objectType: string): { minWidth: number; minHeight: number } {
  if (objectType === 'sticky') {
    return { minWidth: MIN_STICKY_WIDTH, minHeight: MIN_STICKY_HEIGHT };
  }
  return { minWidth: MIN_OBJECT_WIDTH, minHeight: MIN_OBJECT_HEIGHT };
}

export interface ResizeSession {
  id: string;
  corner: ResizeCorner;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  pointerStartX: number;
  pointerStartY: number;
}

export function createResizeSession(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  pointerX: number,
  pointerY: number,
  corner: ResizeCorner = 'se'
): ResizeSession {
  return {
    id,
    corner,
    startX: x,
    startY: y,
    startWidth: width,
    startHeight: height,
    pointerStartX: pointerX,
    pointerStartY: pointerY,
  };
}

export function computeResizePreview(
  session: ResizeSession,
  pointerX: number,
  pointerY: number,
  snap: (v: number) => number,
  minWidth = MIN_OBJECT_WIDTH,
  minHeight = MIN_OBJECT_HEIGHT
): { x: number; y: number; width: number; height: number } {
  const dx = pointerX - session.pointerStartX;
  const dy = pointerY - session.pointerStartY;
  let x = session.startX;
  let y = session.startY;
  let width = session.startWidth;
  let height = session.startHeight;

  switch (session.corner) {
    case 'se':
      width = Math.max(minWidth, snap(session.startWidth + dx));
      height = Math.max(minHeight, snap(session.startHeight + dy));
      break;
    case 'sw':
      width = Math.max(minWidth, snap(session.startWidth - dx));
      height = Math.max(minHeight, snap(session.startHeight + dy));
      x = snap(session.startX + session.startWidth - width);
      break;
    case 'ne':
      width = Math.max(minWidth, snap(session.startWidth + dx));
      height = Math.max(minHeight, snap(session.startHeight - dy));
      y = snap(session.startY + session.startHeight - height);
      break;
    case 'nw':
      width = Math.max(minWidth, snap(session.startWidth - dx));
      height = Math.max(minHeight, snap(session.startHeight - dy));
      x = snap(session.startX + session.startWidth - width);
      y = snap(session.startY + session.startHeight - height);
      break;
  }

  return { x, y, width, height };
}
