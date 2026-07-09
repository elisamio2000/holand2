import type { IconType } from 'react-icons';
import {
  PiBriefcaseDuotone,
  PiBuildingsDuotone,
  PiChartBarDuotone,
  PiFlaskDuotone,
  PiFolderDuotone,
  PiGlobeDuotone,
  PiMagnifyingGlassDuotone,
  PiScalesDuotone,
  PiShieldCheckDuotone,
} from 'react-icons/pi';

export interface WorkspaceIconOption {
  key: string;
  Icon: IconType;
  labelKey: string;
}

export const WORKSPACE_ICON_CATALOG: WorkspaceIconOption[] = [
  { key: 'buildings', Icon: PiBuildingsDuotone, labelKey: 'workspace.branding.icons.buildings' },
  { key: 'folder', Icon: PiFolderDuotone, labelKey: 'workspace.branding.icons.folder' },
  { key: 'shield', Icon: PiShieldCheckDuotone, labelKey: 'workspace.branding.icons.shield' },
  { key: 'search', Icon: PiMagnifyingGlassDuotone, labelKey: 'workspace.branding.icons.search' },
  { key: 'scales', Icon: PiScalesDuotone, labelKey: 'workspace.branding.icons.scales' },
  { key: 'chart', Icon: PiChartBarDuotone, labelKey: 'workspace.branding.icons.chart' },
  { key: 'globe', Icon: PiGlobeDuotone, labelKey: 'workspace.branding.icons.globe' },
  { key: 'briefcase', Icon: PiBriefcaseDuotone, labelKey: 'workspace.branding.icons.briefcase' },
  { key: 'flask', Icon: PiFlaskDuotone, labelKey: 'workspace.branding.icons.flask' },
];

export const DEFAULT_WORKSPACE_ICON_KEY = 'buildings';

export function getWorkspaceIconByKey(key: string): WorkspaceIconOption {
  return (
    WORKSPACE_ICON_CATALOG.find((i) => i.key === key) ??
    WORKSPACE_ICON_CATALOG[0]
  );
}
