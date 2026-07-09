export type WorkspaceNavTemplateId =
  | 'investigation'
  | 'legal'
  | 'admin'
  | 'minimal'
  | 'custom';

export interface WorkspaceNavItemRef {
  id: string;
  visible: boolean;
  order: number;
}

export interface WorkspaceTeamNavPreset {
  schemaVersion: 1;
  items: WorkspaceNavItemRef[];
  hiddenSections?: string[];
  templateId?: WorkspaceNavTemplateId;
}

export interface WorkspaceUserNavOverlay {
  schemaVersion: 1;
  pinnedIds: string[];
  hiddenIds: string[];
  orderOverrides?: Record<string, number>;
}

export interface WorkspaceNavigationSettings {
  team: WorkspaceTeamNavPreset;
  user?: WorkspaceUserNavOverlay;
}
