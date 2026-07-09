/** Minimal message shape for arc turn grouping (live chat + HTML export). */
export interface ArcNavMessageLike {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  thinking?: string | null;
  streamContent?: string;
  streamThinking?: string;
}

/** One conversation turn = user request + optional assistant reply. */
export interface ArcNavTurn {
  id: string;
  userMessageId: string;
  assistantMessageId?: string;
  /** Short label for active slot (optional) */
  label: string;
  /** Full user message text for tooltips */
  fullLabel: string;
  weight: number;
  userChars: number;
  assistantChars: number;
}

export interface ArcLineGeometry {
  length: number;
  opacity: number;
  offsetX: number;
  isActive: boolean;
  lineHeight: number;
  showDot: boolean;
}

/** One fixed slot in the radio-dial window (center slot = active turn). */
export interface ArcDialSlot {
  turn: ArcNavTurn | null;
  globalIndex: number;
  slotIndex: number;
}

export const ARC_MIN_LINE_PX = 8;
export const ARC_MAX_LINE_PX = 38;
export const ARC_ACTIVE_LENGTH_BONUS = 3;
export const ARC_EDGE_FADE_ZONE = 0.28;

/** Fixed slot count — active turn always sits at ARC_NAV_CENTER_SLOT. */
export const ARC_NAV_SLOT_COUNT = 21;
export const ARC_NAV_CENTER_SLOT = Math.floor(ARC_NAV_SLOT_COUNT / 2);

function textLen(msg?: ArcNavMessageLike): number {
  if (!msg) return 0;
  const body = msg.streamContent ?? msg.content ?? '';
  const thinking = msg.thinking ?? msg.streamThinking ?? '';
  return body.length + thinking.length;
}

function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t || '…';
  return `${t.slice(0, max - 1)}…`;
}

export function buildTurnsFromMessages(messages: ArcNavMessageLike[]): ArcNavTurn[] {
  const turns: ArcNavTurn[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];
    if (msg.role === 'user') {
      const userMsg = msg;
      const next = messages[i + 1];
      const assistantMsg = next?.role === 'assistant' ? next : undefined;
      const m = textLen(userMsg);
      const n = textLen(assistantMsg);
      const userText = (userMsg.content || '').replace(/\s+/g, ' ').trim();
      turns.push({
        id: userMsg.id,
        userMessageId: userMsg.id,
        assistantMessageId: assistantMsg?.id,
        label: truncate(userText, 28),
        fullLabel: userText || '…',
        weight: Math.max(1, m + n),
        userChars: m,
        assistantChars: n,
      });
      i += assistantMsg ? 2 : 1;
    } else if (msg.role === 'assistant') {
      const n = textLen(msg);
      const assistantText = (msg.content || '').replace(/\s+/g, ' ').trim();
      turns.push({
        id: msg.id,
        userMessageId: msg.id,
        label: truncate(assistantText, 28),
        fullLabel: assistantText || '…',
        weight: Math.max(1, n),
        userChars: 0,
        assistantChars: n,
      });
      i += 1;
    } else {
      i += 1;
    }
  }

  return turns;
}

/**
 * Build a fixed-size dial window: active turn is always at the center slot.
 * Neighbouring turns fill slots above/below; empty slots at list edges fade out.
 */
export function buildDialSlots(
  turns: ArcNavTurn[],
  activeIndex: number
): ArcDialSlot[] {
  const slots: ArcDialSlot[] = [];
  for (let i = 0; i < ARC_NAV_SLOT_COUNT; i++) {
    const globalIndex = activeIndex - ARC_NAV_CENTER_SLOT + i;
    const turn =
      globalIndex >= 0 && globalIndex < turns.length
        ? turns[globalIndex]
        : null;
    slots.push({ turn, globalIndex, slotIndex: i });
  }
  return slots;
}

function gaussian(index: number, total: number, sigma: number): number {
  if (total <= 1) return 1;
  const mid = (total - 1) / 2;
  const x = (index - mid) / sigma;
  return Math.exp(-0.5 * x * x);
}

export function computeArcLineGeometry(
  index: number,
  total: number,
  weight: number,
  maxWeight: number,
  activeIndex: number,
  options?: { placeholder?: boolean }
): ArcLineGeometry {
  const isActive = index === activeIndex;
  const placeholder = options?.placeholder ?? false;

  const weightRatio = maxWeight > 0 ? weight / maxWeight : 0.5;
  let length =
    ARC_MIN_LINE_PX + weightRatio * (ARC_MAX_LINE_PX - ARC_MIN_LINE_PX);
  if (isActive) length += ARC_ACTIVE_LENGTH_BONUS;
  if (placeholder) length = ARC_MIN_LINE_PX * 0.6;

  const sigma = Math.max(total / 3.5, 2);
  const bell = gaussian(index, total, sigma);
  const edgeT = total > 1 ? index / (total - 1) : 0.5;
  const edgeFade = Math.min(
    Math.min(edgeT / ARC_EDGE_FADE_ZONE, 1),
    Math.min((1 - edgeT) / ARC_EDGE_FADE_ZONE, 1)
  );
  const veil = Math.pow(edgeFade, 1.5) * (0.3 + 0.7 * bell);
  const offsetX = (1 - bell) * 4;

  let opacity: number;
  if (isActive) {
    opacity = 1;
  } else if (placeholder) {
    opacity = 0.04 + veil * 0.06;
  } else {
    opacity = 0.2 + veil * 0.35 + weightRatio * 0.08;
    opacity = Math.min(opacity, 0.55);
  }

  return {
    length,
    opacity,
    offsetX,
    isActive,
    lineHeight: isActive ? 2 : 1,
    showDot: isActive,
  };
}

export function arcMessageAnchorId(messageId: string): string {
  return `arc-msg-${messageId}`;
}

export const ARC_NAV_MIN_TURNS = 6;

/** @deprecated Use ARC_NAV_SLOT_COUNT — kept for HTML export script compat. */
export const ARC_NAV_WINDOW = ARC_NAV_SLOT_COUNT;

