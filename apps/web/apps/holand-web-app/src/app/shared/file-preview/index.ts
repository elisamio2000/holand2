// ============================================
// File Preview — Global shared module
// Central export point for file preview components and utilities.
// Usable from any page/section in the application (not just chat).
//
// NOTE: Components internally use chatService.getAuthHeaders() for JWT-based
// file fetching. This works globally because auth is from next-auth session,
// not chat-specific state.
//
// Usage from any page:
//   import { FilePreviewModalView, useFilePreview, getFileCategory } from '@/app/shared/file-preview';
//   const { openFilePreview } = useFilePreview();
//   openFilePreview({ src: url, name: 'file.pdf', mimeType: 'application/pdf' });
// ============================================

export { default as FilePreviewModalView } from '@/app/shared/ai-chat/file-preview-modal';
export { default as FilePreviewInline } from '@/app/shared/ai-chat/file-preview-inline';
export { getFileCategory } from '@/utils/mime-utils';
export { useFilePreview } from '@/hooks/use-file-preview';
