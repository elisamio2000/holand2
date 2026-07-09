import { storageService } from '@/services/storage.service';
import type { AttachmentInfo } from '@/types/messages.types';
import { isMessagesMockActive } from './mock/config';
import { MOCK_ATTACHMENT_URLS } from './mock/mock-attachment-urls';

/** True when the URL can be loaded without gateway auth (CDN, placeholders, etc.). */
export function isPublicAttachmentUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** Resolve preview/download src for a message attachment (mock URLs, explicit url, or storage API). */
export function resolveMessageAttachmentSrc(att: AttachmentInfo): string {
  if (att.url) return att.url;
  if (isMessagesMockActive() && MOCK_ATTACHMENT_URLS[att.id]) {
    return MOCK_ATTACHMENT_URLS[att.id];
  }
  return storageService.getDownloadUrl(att.id, 'inline');
}
