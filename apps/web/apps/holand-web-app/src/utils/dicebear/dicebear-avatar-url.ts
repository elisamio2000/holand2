import { createAvatar } from '@dicebear/core';
import type { DiceBearStyleKey } from './dicebear-registry';
import {
  DEFAULT_DICEBEAR_STYLE,
  getDiceBearStyleModule,
} from './dicebear-registry';
import {
  buildDiceBearOptions,
  DICEBEAR_RANDOM,
  extractFieldValuesFromOptions,
  getDefaultFieldValues,
  getDiceBearFieldsForStyle,
  type DiceBearFieldDefinition,
} from './dicebear-schema-utils';

export {
  getDefaultFieldValues,
  getDiceBearFieldsForStyle,
} from './dicebear-schema-utils';

export const DICEBEAR_URL_PREFIX = 'dicebear:';

export interface DiceBearAvatarConfig {
  v: 1;
  style: DiceBearStyleKey;
  options: Record<string, unknown>;
}

export function isDiceBearAvatarUrl(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(DICEBEAR_URL_PREFIX));
}

export function encodeDiceBearAvatarUrl(config: DiceBearAvatarConfig): string {
  const json = JSON.stringify(config);
  const base64 =
    typeof window !== 'undefined'
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, 'utf-8').toString('base64');
  return `${DICEBEAR_URL_PREFIX}${base64}`;
}

export function decodeDiceBearAvatarUrl(
  value: string | null | undefined
): DiceBearAvatarConfig | null {
  if (!isDiceBearAvatarUrl(value) || !value) return null;

  try {
    const base64 = value.slice(DICEBEAR_URL_PREFIX.length);
    const json =
      typeof window !== 'undefined'
        ? decodeURIComponent(escape(atob(base64)))
        : Buffer.from(base64, 'base64').toString('utf-8');
    const parsed = JSON.parse(json) as DiceBearAvatarConfig;
    if (parsed?.v !== 1 || !parsed.style || !parsed.options) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function renderDiceBearConfig(config: DiceBearAvatarConfig): string {
  const styleModule = getDiceBearStyleModule(config.style);
  return createAvatar(styleModule, config.options).toDataUri();
}

export function renderDiceBearFromValues(
  styleKey: DiceBearStyleKey,
  fieldValues: Record<string, unknown>,
  fields?: DiceBearFieldDefinition[]
): string {
  const resolvedFields = fields ?? getDiceBearFieldsForStyle(styleKey);
  const options = buildDiceBearOptions(resolvedFields, fieldValues);
  return createAvatar(getDiceBearStyleModule(styleKey), options).toDataUri();
}

export function createDiceBearConfigFromValues(
  styleKey: DiceBearStyleKey,
  fieldValues: Record<string, unknown>,
  fields?: DiceBearFieldDefinition[]
): DiceBearAvatarConfig {
  const resolvedFields = fields ?? getDiceBearFieldsForStyle(styleKey);
  return {
    v: 1,
    style: styleKey,
    options: buildDiceBearOptions(resolvedFields, fieldValues),
  };
}

export function resolveAvatarSrc(
  avatarUrl: string | null | undefined,
  fallbackSeed: string
): string {
  if (!avatarUrl) {
    return renderDiceBearFromValues(DEFAULT_DICEBEAR_STYLE, { seed: fallbackSeed });
  }

  const config = decodeDiceBearAvatarUrl(avatarUrl);
  if (config) {
    return renderDiceBearConfig(config);
  }

  return avatarUrl;
}

export function loadAvatarBuilderState(
  avatarUrl: string | null | undefined,
  defaultSeed: string
): {
  styleKey: DiceBearStyleKey;
  fieldValues: Record<string, unknown>;
  fields: DiceBearFieldDefinition[];
} {
  const decoded = decodeDiceBearAvatarUrl(avatarUrl);

  if (decoded) {
    const fields = getDiceBearFieldsForStyle(decoded.style);
    const fieldValues = {
      ...getDefaultFieldValues(fields, defaultSeed),
      ...extractFieldValuesFromOptions(fields, decoded.options),
    };
    if (!fieldValues.seed) fieldValues.seed = defaultSeed;
    return { styleKey: decoded.style, fieldValues, fields };
  }

  const styleKey = DEFAULT_DICEBEAR_STYLE;
  const fields = getDiceBearFieldsForStyle(styleKey);
  return {
    styleKey,
    fields,
    fieldValues: getDefaultFieldValues(fields, defaultSeed),
  };
}

export function createStylePreviewDataUri(
  styleKey: DiceBearStyleKey,
  seed: string,
  size = 64
): string {
  return createAvatar(getDiceBearStyleModule(styleKey), { seed, size }).toDataUri();
}

const previewCache = new Map<string, string>();
const PREVIEW_CACHE_LIMIT = 400;

function hashFieldValues(fieldValues: Record<string, unknown>): string {
  return JSON.stringify(fieldValues);
}

function setPreviewCache(key: string, value: string) {
  if (previewCache.size >= PREVIEW_CACHE_LIMIT) {
    const firstKey = previewCache.keys().next().value;
    if (firstKey) previewCache.delete(firstKey);
  }
  previewCache.set(key, value);
}

export function renderOptionPreview(
  styleKey: DiceBearStyleKey,
  fieldValues: Record<string, unknown>,
  fields: DiceBearFieldDefinition[],
  fieldKey: string,
  enumValue: string | typeof DICEBEAR_RANDOM,
  size = 56
): string {
  const cacheKey = `${styleKey}:${fieldKey}:${enumValue}:${hashFieldValues(fieldValues)}:${size}`;
  const cached = previewCache.get(cacheKey);
  if (cached) return cached;

  const previewValues = { ...fieldValues, [fieldKey]: enumValue };
  const options = {
    ...buildDiceBearOptions(fields, previewValues),
    size,
  };
  const uri = createAvatar(getDiceBearStyleModule(styleKey), options).toDataUri();
  setPreviewCache(cacheKey, uri);
  return uri;
}

export function clearOptionPreviewCache() {
  previewCache.clear();
}

export function isValidAvatarUrl(value: string): boolean {
  if (!value) return true;
  if (isDiceBearAvatarUrl(value)) return true;
  if (value.startsWith('data:image/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return value.startsWith('/');
  }
}
