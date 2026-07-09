// ============================================
// REMOVABLE MOCK LAYER — delete this entire `mock/` folder when backend is ready,
// then remove the import block marked MOCK_LAYER in messages.service.ts.
// Gated by NEXT_PUBLIC_MESSAGES_MOCK (never active in production unless explicitly set).
// ============================================

export { getMessagesMockMode } from './config';
export {
  isMockMessagesActive,
  mockMessagesApi,
  setMockMessagesActive,
} from './mock-messages-api';
