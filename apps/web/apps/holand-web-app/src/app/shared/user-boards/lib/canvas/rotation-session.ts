export interface RotationSession {
  id: string;
  cx: number;
  cy: number;
  startRotation: number;
  startAngle: number;
}

export function angleFromCenter(cx: number, cy: number, px: number, py: number): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
}

export function createRotationSession(
  id: string,
  cx: number,
  cy: number,
  startRotation: number,
  pointerX: number,
  pointerY: number
): RotationSession {
  return {
    id,
    cx,
    cy,
    startRotation,
    startAngle: angleFromCenter(cx, cy, pointerX, pointerY),
  };
}

export function computeRotationPreview(session: RotationSession, pointerX: number, pointerY: number): number {
  const current = angleFromCenter(session.cx, session.cy, pointerX, pointerY);
  const delta = current - session.startAngle;
  return Math.round(session.startRotation + delta);
}
