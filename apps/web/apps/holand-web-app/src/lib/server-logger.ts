/**
 * Server-side structured logger for Next.js middleware and API routes.
 * English-only output, ANSI colors on TTY, one line per event (no duplicates).
 *
 * Env:
 *   LOG_LEVEL=debug|info|warn|error|silent  (default: info)
 *   HTTP_LOG=compact|verbose|off              (default: compact)
 *   NO_COLOR=1                                (disable ANSI)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export type HttpLogComponent = 'middleware' | 'gateway' | 'api';

export interface HttpLogEntry {
  component: HttpLogComponent;
  method: string;
  path: string;
  status?: number;
  durationMs?: number;
  clientIp?: string;
  auth?: 'ok' | 'missing' | 'denied';
  detail?: string;
}

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  http: (entry: HttpLogEntry) => void;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  silent: 99,
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function resolveLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  if (raw in LEVEL_RANK) return raw as LogLevel;
  return 'info';
}

function resolveHttpLogMode(): 'compact' | 'verbose' | 'off' {
  const raw = (process.env.HTTP_LOG ?? 'compact').toLowerCase();
  if (raw === 'verbose' || raw === 'off') return raw;
  return 'compact';
}

function isNodeTty(): boolean {
  if (typeof process === 'undefined') return false;
  const stdout = process.stdout as { isTTY?: boolean } | undefined;
  return stdout?.isTTY === true;
}

/** Edge middleware has no process.stdout — must not throw. */
function terminalColorEnabled(): boolean {
  if (process.env.NO_COLOR === '1') return false;
  return isNodeTty();
}

function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LEVEL_RANK[level] <= LEVEL_RANK[minLevel];
}

function formatMeta(meta?: Record<string, unknown>, colorEnabled = true): string {
  if (!meta || Object.keys(meta).length === 0) return '';
  const parts = Object.entries(meta)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => {
      const rendered =
        typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);
      return `${key}=${rendered}`;
    });
  if (!parts.length) return '';
  return colorEnabled
    ? ` ${COLORS.dim}${parts.join(' ')}${COLORS.reset}`
    : ` ${parts.join(' ')}`;
}

function statusColor(status?: number, colorEnabled = true): string {
  if (!status) return colorEnabled ? COLORS.gray : '';
  if (status >= 500) return colorEnabled ? COLORS.red : '';
  if (status >= 400) return colorEnabled ? COLORS.yellow : '';
  return colorEnabled ? COLORS.green : '';
}

function writeLine(
  level: LogLevel,
  minLevel: LogLevel,
  scope: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  if (!shouldLog(level, minLevel)) return;

  const color = terminalColorEnabled();
  const ts = new Date().toISOString();
  const levelColors: Record<Exclude<LogLevel, 'silent'>, string> = {
    debug: COLORS.gray,
    info: COLORS.cyan,
    warn: COLORS.yellow,
    error: COLORS.red,
  };

  const levelLabel = level.toUpperCase().padEnd(5);
  const scopeLabel = `[${scope}]`;
  const levelColor =
    level === 'silent' ? '' : levelColors[level as Exclude<LogLevel, 'silent'>];
  const line = [
    color ? `${COLORS.dim}${ts}${COLORS.reset}` : ts,
    color && levelColor ? `${levelColor}${levelLabel}${COLORS.reset}` : levelLabel,
    color ? `${COLORS.magenta}${scopeLabel}${COLORS.reset}` : scopeLabel,
    message,
    formatMeta(meta, color),
  ].join(' ');

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

function shouldLogHttp(entry: HttpLogEntry, mode: 'compact' | 'verbose' | 'off'): boolean {
  if (mode === 'off') return false;
  if (mode === 'verbose') return true;

  if (entry.component === 'middleware') {
    return entry.auth === 'missing' || entry.auth === 'denied';
  }

  if (entry.component === 'gateway') {
    if (entry.status != null && entry.status >= 400) return true;
    if (entry.durationMs != null && entry.durationMs >= 1_500) return true;
    return true;
  }

  return entry.status == null || entry.status >= 400;
}

function formatHttpLine(entry: HttpLogEntry, color: boolean): string {
  const method = entry.method.toUpperCase().padEnd(6);
  const status =
    entry.status != null
      ? color
        ? `${statusColor(entry.status, true)}${entry.status}${COLORS.reset}`
        : String(entry.status)
      : color
        ? `${COLORS.gray}---${COLORS.reset}`
        : '---';
  const duration =
    entry.durationMs != null
      ? color
        ? `${COLORS.dim}${entry.durationMs}ms${COLORS.reset}`
        : `${entry.durationMs}ms`
      : '';
  const auth =
    entry.auth && entry.auth !== 'ok'
      ? color
        ? `${COLORS.yellow}auth=${entry.auth}${COLORS.reset}`
        : `auth=${entry.auth}`
      : '';
  const client = entry.clientIp ? `client=${entry.clientIp}` : '';
  const detail = entry.detail ? `detail=${entry.detail}` : '';

  return [
    color ? `${COLORS.blue}${method}${COLORS.reset}` : method,
    entry.path,
    '->',
    status,
    duration,
    auth,
    client,
    detail,
  ]
    .filter(Boolean)
    .join(' ');
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, meta) =>
      writeLine('debug', resolveLevel(), scope, message, meta),
    info: (message, meta) =>
      writeLine('info', resolveLevel(), scope, message, meta),
    warn: (message, meta) =>
      writeLine('warn', resolveLevel(), scope, message, meta),
    error: (message, meta) =>
      writeLine('error', resolveLevel(), scope, message, meta),
    http: (entry) => {
      const httpMode = resolveHttpLogMode();
      const minLevel = resolveLevel();
      if (!shouldLogHttp(entry, httpMode)) return;
      if (!shouldLog('info', minLevel)) return;
      const color = terminalColorEnabled();
      const line = formatHttpLine(entry, color);
      const ts = new Date().toISOString();
      const scopeLabel = `[${entry.component}]`;
      const prefix = [
        color ? `${COLORS.dim}${ts}${COLORS.reset}` : ts,
        color ? `${COLORS.cyan}INFO ${COLORS.reset}` : 'INFO ',
        color ? `${COLORS.magenta}${scopeLabel}${COLORS.reset}` : scopeLabel,
      ].join(' ');
      console.log(`${prefix} ${line}`);
    },
  };
}

let gatewayLoggerInstance: Logger | undefined;

function getGatewayLogger(): Logger {
  gatewayLoggerInstance ??= createLogger('Gateway');
  return gatewayLoggerInstance;
}

/** Node.js API routes only (not Edge middleware). */
export const gatewayLogger: Logger = {
  debug: (message, meta) => getGatewayLogger().debug(message, meta),
  info: (message, meta) => getGatewayLogger().info(message, meta),
  warn: (message, meta) => getGatewayLogger().warn(message, meta),
  error: (message, meta) => getGatewayLogger().error(message, meta),
  http: (entry) => getGatewayLogger().http(entry),
};
