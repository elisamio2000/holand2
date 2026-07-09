import type {
  BoardConnectorObject,
  BoardObject,
  BoardObjectBase,
  BoardSnapshot,
  BoardStrokeStyle,
  BoardArrowDirection,
  BoardStyleDefaults,
} from './board-types';
import { DEFAULT_BOARD_STYLE } from './board-style-defaults';

export { DEFAULT_BOARD_STYLE } from './board-style-defaults';
export type { BoardStyleDefaults } from './board-types';

export function strokeDasharray(style: BoardStrokeStyle | undefined): string | undefined {
  if (style === 'dashed') return '6 4';
  if (style === 'dotted') return '2 4';
  return undefined;
}

export function resolveArrowDirection(
  connector: BoardConnectorObject,
  defaults?: BoardStyleDefaults
): BoardArrowDirection {
  if (connector.arrowDirection) return connector.arrowDirection;
  if (connector.arrowStart && connector.arrowEnd) return 'both';
  if (connector.arrowStart && connector.arrowEnd === false) return 'backward';
  if (connector.arrowEnd === false && !connector.arrowStart) return 'none';
  return defaults?.connectorArrowDirection ?? 'forward';
}

export function arrowDirectionToFlags(direction: BoardArrowDirection): { start: boolean; end: boolean } {
  switch (direction) {
    case 'none':
      return { start: false, end: false };
    case 'backward':
      return { start: true, end: false };
    case 'both':
      return { start: true, end: true };
    default:
      return { start: false, end: true };
  }
}

export interface ResolvedConnectorStyle {
  color: string;
  strokeWidth: number;
  strokeStyle: BoardStrokeStyle;
  opacity: number;
  arrowDirection: BoardArrowDirection;
  arrowStart: boolean;
  arrowEnd: boolean;
}

export function resolveConnectorStyle(
  connector: BoardConnectorObject,
  defaults?: BoardStyleDefaults
): ResolvedConnectorStyle {
  const arrowDirection = resolveArrowDirection(connector, defaults);
  const flags = arrowDirectionToFlags(arrowDirection);
  return {
    color: connector.color ?? defaults?.connectorColor ?? DEFAULT_BOARD_STYLE.connectorColor!,
    strokeWidth: connector.strokeWidth ?? defaults?.connectorStrokeWidth ?? DEFAULT_BOARD_STYLE.connectorStrokeWidth!,
    strokeStyle: connector.strokeStyle ?? defaults?.connectorStrokeStyle ?? DEFAULT_BOARD_STYLE.connectorStrokeStyle!,
    opacity: connector.opacity ?? defaults?.connectorOpacity ?? DEFAULT_BOARD_STYLE.connectorOpacity!,
    arrowDirection,
    arrowStart: flags.start,
    arrowEnd: flags.end,
  };
}

export function resolveObjectOpacity(
  obj: BoardObject & BoardObjectBase,
  defaults?: BoardStyleDefaults
): number {
  return obj.opacity ?? defaults?.objectOpacity ?? DEFAULT_BOARD_STYLE.objectOpacity!;
}

export function getBoardStyleDefaults(snapshot: BoardSnapshot): BoardStyleDefaults {
  return { ...DEFAULT_BOARD_STYLE, ...(snapshot.styleDefaults ?? {}) };
}
