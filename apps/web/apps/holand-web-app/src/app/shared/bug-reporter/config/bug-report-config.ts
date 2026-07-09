export type BugReportDeliveryChannel = 'email' | 'chat';

export interface BugReportConfig {
  enabled: boolean;
  /** Admin-configured support recipient (single user) */
  recipientId: string;
  /** Resolved pool — always 0 or 1 id for end-user composer */
  recipientIds: string[];
  defaultChannel: BugReportDeliveryChannel;
  rollingBufferEnabled: boolean;
  bufferSeconds: number;
  maskPii: boolean;
}

export interface BugReportAdminConfig {
  enabled?: boolean;
  recipientId?: string;
  recipientIds?: string[];
  defaultChannel?: BugReportDeliveryChannel;
}

const DEFAULT_RECIPIENT = '9e50d244-ca8f-49ef-8dc0-ed21cd3487ed';
const DEFAULT_BUFFER_SECONDS = 30;

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
}

function parseChannel(value: string | undefined): BugReportDeliveryChannel {
  return value === 'chat' ? 'chat' : 'email';
}

/** Env-only bootstrap until admin settings load */
export function getEnvConfig(): BugReportConfig {
  const recipientId =
    process.env.NEXT_PUBLIC_BUG_REPORT_RECIPIENT?.trim() ||
    process.env.NEXT_PUBLIC_SUPPORT_USER_ID?.trim() ||
    DEFAULT_RECIPIENT;
  return {
    enabled: parseBool(process.env.NEXT_PUBLIC_BUG_REPORT_ENABLED, true),
    recipientId,
    recipientIds: recipientId ? [recipientId] : [],
    defaultChannel: parseChannel(process.env.NEXT_PUBLIC_BUG_REPORT_DEFAULT_CHANNEL),
    rollingBufferEnabled: parseBool(process.env.NEXT_PUBLIC_BUG_ROLLING_BUFFER, true),
    bufferSeconds: Number(process.env.NEXT_PUBLIC_BUG_BUFFER_SECONDS) || DEFAULT_BUFFER_SECONDS,
    maskPii: parseBool(process.env.NEXT_PUBLIC_BUG_MASK_PII, true),
  };
}

export function parseAdminBugReportSettings(
  settings: Record<string, unknown> | null | undefined
): BugReportAdminConfig {
  if (!settings) return {};

  const admin: BugReportAdminConfig = {};

  if (typeof settings.bug_report_enabled === 'boolean') {
    admin.enabled = settings.bug_report_enabled;
  }
  if (typeof settings.bug_report_recipient === 'string' && settings.bug_report_recipient.trim()) {
    admin.recipientId = settings.bug_report_recipient.trim();
  }
  if (settings.bug_report_default_channel === 'email' || settings.bug_report_default_channel === 'chat') {
    admin.defaultChannel = settings.bug_report_default_channel;
  }

  return admin;
}

export function mergeConfig(
  env: BugReportConfig,
  admin: BugReportAdminConfig
): BugReportConfig {
  const enabled = admin.enabled !== undefined ? admin.enabled : env.enabled;
  const recipientId = admin.recipientId?.trim() || env.recipientId;

  return {
    ...env,
    enabled,
    recipientId,
    recipientIds: recipientId ? [recipientId] : [],
    defaultChannel: admin.defaultChannel ?? env.defaultChannel,
  };
}

export function isBugReportActive(config: BugReportConfig): boolean {
  return config.enabled;
}

/** @deprecated Multi-recipient pool removed — use single admin-configured recipientId */
export function buildRecipientIdPool(recipientId: string, _extraIds: string[] = []): string[] {
  return recipientId ? [recipientId] : [];
}
