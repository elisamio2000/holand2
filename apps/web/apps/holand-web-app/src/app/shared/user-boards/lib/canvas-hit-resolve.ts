export type CanvasContextHit =
  | { kind: 'canvas'; worldX: number; worldY: number }
  | { kind: 'object'; id: string; objectType: string }
  | { kind: 'ink'; id: string };

export function resolveCanvasContextHit(
  target: EventTarget | null,
  world: { worldX: number; worldY: number }
): CanvasContextHit {
  const el =
    target && typeof Element !== 'undefined' && target instanceof Element ? target : null;
  if (!el) return { kind: 'canvas', ...world };

  const ink = el.closest('[data-board-ink]');
  if (ink) {
    const id = ink.getAttribute('data-board-ink');
    if (id) return { kind: 'ink', id };
  }

  const obj = el.closest('[data-board-object]');
  if (obj) {
    const id = obj.getAttribute('data-board-object');
    const objectType = obj.getAttribute('data-board-type') ?? 'unknown';
    if (id) return { kind: 'object', id, objectType };
  }

  return { kind: 'canvas', ...world };
}
