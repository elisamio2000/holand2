// ============================================
// User Messenger — mock layer config (messages page only)
// ============================================

export type MessagesMockMode = 'off' | 'only' | 'fallback';

/**
 * Controls mock behaviour for the messenger UI.
 *
 * Default: **off** — always use the real gateway (show API errors).
 *
 * - `NEXT_PUBLIC_MESSAGES_MOCK=true` → mock only (skip gateway; UX preview).
 * - `NEXT_PUBLIC_MESSAGES_MOCK=fallback` → try gateway, sample data on failure.
 * - `NEXT_PUBLIC_MESSAGES_MOCK=false` or unset → gateway only.
 */
export function getMessagesMockMode(): MessagesMockMode {
  const flag = process.env.NEXT_PUBLIC_MESSAGES_MOCK;
  if (flag === 'true') return 'only';
  if (flag === 'fallback') return 'fallback';
  return 'off';
}

export function isMessagesMockActive(): boolean {
  return getMessagesMockMode() !== 'off';
}
