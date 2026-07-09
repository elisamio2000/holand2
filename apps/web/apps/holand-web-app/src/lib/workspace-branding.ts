import {
  DEFAULT_PRESET_COLOR_NAME,
  DEFAULT_PRESET_COLORS,
} from '@/config/color-presets';
import { DEFAULT_WORKSPACE_ICON_KEY } from '@/lib/workspace-icon-catalog';

export const WORKSPACE_HOME_KEY = 'Holand:workspace-home-id';
export const GLOBAL_BRANDING_KEY = 'Holand:ws-branding:__global__';
const BRANDING_PREFIX = 'Holand:ws-branding:';

export type WorkspaceAvatarKind = 'icon' | 'image';
export type WorkspaceThemeMode = 'light' | 'dark' | 'system';

export interface WorkspaceBranding {
  avatarKind: WorkspaceAvatarKind;
  iconKey: string;
  imageUrl: string | null;
  colorPresetName: string;
  themeMode: WorkspaceThemeMode;
  useGlobalAppearance: boolean;
}

const DEFAULT_BRANDING: WorkspaceBranding = {
  avatarKind: 'icon',
  iconKey: DEFAULT_WORKSPACE_ICON_KEY,
  imageUrl: null,
  colorPresetName: DEFAULT_PRESET_COLOR_NAME,
  themeMode: 'system',
  useGlobalAppearance: true,
};

function brandingKey(workspaceId: string) {
  return `${BRANDING_PREFIX}${workspaceId}`;
}

function normalizeBranding(raw: Partial<WorkspaceBranding> & { avatar?: string }): WorkspaceBranding {
  const iconKey =
    raw.iconKey ??
    (raw.avatar && !raw.avatar.startsWith('http') && raw.avatar.length > 2
      ? DEFAULT_WORKSPACE_ICON_KEY
      : DEFAULT_BRANDING.iconKey);

  return {
    avatarKind: raw.avatarKind ?? (raw.imageUrl ? 'image' : 'icon'),
    iconKey,
    imageUrl: raw.imageUrl ?? null,
    colorPresetName: raw.colorPresetName ?? DEFAULT_BRANDING.colorPresetName,
    themeMode: raw.themeMode ?? DEFAULT_BRANDING.themeMode,
    useGlobalAppearance: raw.useGlobalAppearance ?? DEFAULT_BRANDING.useGlobalAppearance,
  };
}

export function getGlobalWorkspaceBranding(): WorkspaceBranding {
  if (typeof window === 'undefined') return { ...DEFAULT_BRANDING, useGlobalAppearance: false };
  try {
    const raw = localStorage.getItem(GLOBAL_BRANDING_KEY);
    if (!raw) {
      const colorPresetName =
        localStorage.getItem('holand-preset-name') ?? DEFAULT_PRESET_COLOR_NAME;
      const themeMode =
        (localStorage.getItem('theme') as WorkspaceThemeMode | null) ?? 'system';
      return {
        ...DEFAULT_BRANDING,
        colorPresetName,
        themeMode,
        useGlobalAppearance: false,
      };
    }
    return normalizeBranding(JSON.parse(raw) as Partial<WorkspaceBranding>);
  } catch {
    return { ...DEFAULT_BRANDING, useGlobalAppearance: false };
  }
}

export function setGlobalWorkspaceBranding(patch: Partial<WorkspaceBranding>): WorkspaceBranding {
  const next = normalizeBranding({ ...getGlobalWorkspaceBranding(), ...patch, useGlobalAppearance: false });
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(GLOBAL_BRANDING_KEY, JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent('Holand:workspace-branding-changed', { detail: { workspaceId: '__global__' } })
      );
    } catch {
      // ignore
    }
  }
  return next;
}

export function getWorkspaceBranding(workspaceId: string): WorkspaceBranding {
  if (typeof window === 'undefined') return { ...DEFAULT_BRANDING };
  try {
    const raw = localStorage.getItem(brandingKey(workspaceId));
    if (!raw) return { ...DEFAULT_BRANDING };
    return normalizeBranding(JSON.parse(raw) as Partial<WorkspaceBranding> & { avatar?: string });
  } catch {
    return { ...DEFAULT_BRANDING };
  }
}

/** Effective branding after global cascade (theme/color only). */
export function getEffectiveWorkspaceBranding(workspaceId: string): WorkspaceBranding {
  const local = getWorkspaceBranding(workspaceId);
  if (!local.useGlobalAppearance) return local;
  const global = getGlobalWorkspaceBranding();
  return {
    ...local,
    colorPresetName: global.colorPresetName,
    themeMode: global.themeMode,
  };
}

export function setWorkspaceBranding(
  workspaceId: string,
  patch: Partial<WorkspaceBranding>
): WorkspaceBranding {
  const next = normalizeBranding({ ...getWorkspaceBranding(workspaceId), ...patch });
  try {
    localStorage.setItem(brandingKey(workspaceId), JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent('Holand:workspace-branding-changed', {
        detail: { workspaceId },
      })
    );
  } catch {
    // ignore
  }
  return next;
}

export function getWorkspaceHomeId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(WORKSPACE_HOME_KEY);
  } catch {
    return null;
  }
}

export function setWorkspaceHomeId(workspaceId: string | null): void {
  try {
    if (workspaceId) {
      localStorage.setItem(WORKSPACE_HOME_KEY, workspaceId);
    } else {
      localStorage.removeItem(WORKSPACE_HOME_KEY);
    }
    window.dispatchEvent(new CustomEvent('Holand:workspace-home-changed'));
  } catch {
    // ignore
  }
}

export function isWorkspaceHome(workspaceId: string): boolean {
  return getWorkspaceHomeId() === workspaceId;
}

export function captureGlobalThemeToWorkspace(workspaceId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const colorPresetName =
      localStorage.getItem('holand-preset-name') ?? DEFAULT_PRESET_COLOR_NAME;
    const themeMode =
      (localStorage.getItem('theme') as WorkspaceThemeMode | null) ?? 'system';
    setWorkspaceBranding(workspaceId, {
      colorPresetName,
      themeMode,
      useGlobalAppearance: false,
    });
  } catch {
    // ignore
  }
}

export function readGlobalColorPreset(): typeof DEFAULT_PRESET_COLORS | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('holand-preset');
    if (!raw) return null;
    return JSON.parse(raw) as typeof DEFAULT_PRESET_COLORS;
  } catch {
    return null;
  }
}

export const WORKSPACE_AVATAR_MAX_BYTES = 4 * 1024 * 1024;
export const WORKSPACE_AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export function isValidWorkspaceAvatarFile(file: File): boolean {
  if (!file.type.startsWith('image/')) return false;
  return file.size <= WORKSPACE_AVATAR_MAX_BYTES;
}

