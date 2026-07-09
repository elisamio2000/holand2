import type { SectionInfo } from '@/types/auth.types';

/** Dev fallback when GET /auth/permissions/sections is unavailable. */
export const MOCK_PERMISSION_SECTIONS: SectionInfo[] = [
  { id: 'chat', name: 'AI Chat', description: 'Conversational AI modules' },
  { id: 'cases', name: 'Cases & Files', description: 'Case import and file management' },
  { id: 'boards', name: 'Boards', description: 'Visual workspace boards' },
  { id: 'graph', name: 'Graph Explorer', description: 'Graph analysis tools' },
  { id: 'projects', name: 'Projects & Tasks', description: 'Project management' },
  { id: 'admin', name: 'Administration', description: 'Platform admin tools' },
  { id: 'reports', name: 'Reports', description: 'Reporting and analytics' },
  { id: 'plugins', name: 'Plugins', description: 'External and internal plugins' },
];
