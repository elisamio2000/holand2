import JSZip from 'jszip';
import { chatService } from '@/services/chat.service';
import type { ChatImportResult } from '@/types/chat.types';

/**
 * Development-only: restore sessions from our bulk-backup ZIP manifest.
 * Production must use POST /chat/sessions/import.
 */
export async function parseAndImportBackupZip(file: File): Promise<ChatImportResult> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    return {
      imported_sessions: [],
      failed: [{ reason: 'Invalid backup: missing manifest.json' }],
    };
  }

  const manifest = JSON.parse(await manifestFile.async('string')) as {
    sessions?: Array<{ id: string; title: string }>;
  };

  const imported: ChatImportResult['imported_sessions'] = [];
  const failed: ChatImportResult['failed'] = [];

  const sessionEntries = manifest.sessions ?? [];

  for (const entry of sessionEntries) {
    try {
      const jsonPath = `sessions/${entry.id}/conversation.json`;
      const jsonFile = zip.file(jsonPath);
      if (!jsonFile) {
        failed.push({ title: entry.title, reason: 'Missing conversation.json' });
        continue;
      }
      const data = JSON.parse(await jsonFile.async('string')) as {
        session?: { title?: string };
        messages?: Array<{ role: string; content: string }>;
      };

      const created = await chatService.createSession({
        title: data.session?.title ?? entry.title ?? 'Imported chat',
      });

      const messages = data.messages ?? [];
      for (const msg of messages) {
        if (msg.role === 'user' && msg.content?.trim()) {
          await chatService.sendMessage({
            session_id: created.id,
            message: msg.content,
          });
        }
      }

      imported.push({ id: created.id, title: created.title });
    } catch (error: unknown) {
      failed.push({
        title: entry.title,
        reason: error instanceof Error ? error.message : 'Import failed',
      });
    }
  }

  return { imported_sessions: imported, failed };
}
