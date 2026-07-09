import { messagesService } from '@/services/messages.service';

export interface BugReportRecipient {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

async function resolveConfiguredRecipient(id: string): Promise<BugReportRecipient> {
  const trimmed = id.trim();
  if (!trimmed) {
    return { id: '', name: '' };
  }
  const resolved = await messagesService.resolveDirectoryUser(trimmed);
  if (resolved) {
    return {
      id: resolved.id,
      name: resolved.name || resolved.email || resolved.id,
      email: resolved.email,
    };
  }
  return { id: trimmed, name: trimmed };
}

/**
 * Load the single admin-configured bug report recipient.
 */
export async function fetchBugReportRecipients(
  configuredIds: string[]
): Promise<BugReportRecipient[]> {
  const recipientId = configuredIds[0]?.trim();
  if (!recipientId) return [];
  const recipient = await resolveConfiguredRecipient(recipientId);
  return recipient.id ? [recipient] : [];
}
