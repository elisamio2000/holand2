import type { WorkspaceNavTemplateId, WorkspaceTeamNavPreset } from '@/types/workspace-nav.types';

const INVESTIGATION_IDS = [
  'nav.aiChat',
  'nav.caseImporter',
  'nav.cases',
  'nav.createCase',
  'nav.fileManager',
  'nav.fileExplorer',
  'nav.myBoards',
  'nav.graphExplorer',
];

const LEGAL_IDS = [
  'nav.cases',
  'nav.caseTemplates',
  'nav.categories',
  'nav.reportBuilder',
  'nav.fileManager',
];

const ADMIN_IDS = [
  'nav.aiChat',
  'nav.oneSearch',
  'nav.caseImporter',
  'nav.cases',
  'nav.fileManager',
  'nav.myBoards',
  'nav.projects',
  'nav.messages',
  'nav.adminCommandCenter',
  'nav.rolesAndPermissions',
];

const MINIMAL_IDS = ['nav.aiChat', 'nav.myBoards'];

function presetFromIds(templateId: WorkspaceNavTemplateId, ids: string[]): WorkspaceTeamNavPreset {
  return {
    schemaVersion: 1,
    templateId,
    items: ids.map((id, order) => ({ id, visible: true, order })),
  };
}

export const WORKSPACE_NAV_TEMPLATES: Record<
  WorkspaceNavTemplateId,
  { labelKey: string; preset: WorkspaceTeamNavPreset }
> = {
  investigation: {
    labelKey: 'workspace.nav.templates.investigation',
    preset: presetFromIds('investigation', INVESTIGATION_IDS),
  },
  legal: {
    labelKey: 'workspace.nav.templates.legal',
    preset: presetFromIds('legal', LEGAL_IDS),
  },
  admin: {
    labelKey: 'workspace.nav.templates.admin',
    preset: presetFromIds('admin', ADMIN_IDS),
  },
  minimal: {
    labelKey: 'workspace.nav.templates.minimal',
    preset: presetFromIds('minimal', MINIMAL_IDS),
  },
  custom: {
    labelKey: 'workspace.nav.templates.custom',
    preset: { schemaVersion: 1, templateId: 'custom', items: [] },
  },
};
