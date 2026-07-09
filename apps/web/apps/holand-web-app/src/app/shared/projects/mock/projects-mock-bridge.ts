// ============================================
// REMOVABLE MOCK LAYER — projects mock bridge
// ============================================

export {
  getProjectsMockMode,
  getProjectsModePref,
  getDefaultMockProjectId,
  isMockProjectsId,
  isProjectsMockAllowedByEnvironment,
  resolveProjectsUsesMock,
  MOCK_LIMITS,
} from './config';
export {
  isMockProjectsActive,
  mockProjectsApi,
  resetMockProjectsStore,
  setMockProjectsActive,
} from './mock-projects-api';
