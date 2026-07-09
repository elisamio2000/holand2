import { schema as coreSchema } from '@dicebear/core';
import type { DiceBearStyleKey } from './dicebear-registry';
import { getDiceBearStyleModule } from './dicebear-registry';

export const DICEBEAR_RANDOM = '__random__';

export type DiceBearFieldKind =
  | 'seed'
  | 'boolean'
  | 'integer'
  | 'probability'
  | 'enum'
  | 'colorMulti'
  | 'integerMulti';

export type DiceBearFieldCategory =
  | 'face'
  | 'hair'
  | 'outfit'
  | 'background'
  | 'advanced'
  | 'style';

export type AvatarBuilderTab = 'style' | DiceBearFieldCategory;

interface SchemaProperty {
  type?: string | string[];
  items?: SchemaProperty & { enum?: string[]; pattern?: string };
  enum?: string[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

type SchemaProperties = Record<string, SchemaProperty | boolean>;

export interface DiceBearFieldDefinition {
  key: string;
  label: string;
  kind: DiceBearFieldKind;
  group: 'general' | 'background' | 'style';
  category: DiceBearFieldCategory;
  enumValues?: string[];
  min?: number;
  max?: number;
  defaultValue?: unknown;
}

const CORE_GENERAL_KEYS = new Set([
  'seed',
  'flip',
  'rotate',
  'scale',
  'radius',
  'size',
  'translateX',
  'translateY',
  'clip',
  'randomizeIds',
]);

const CORE_BACKGROUND_KEYS = new Set([
  'backgroundColor',
  'backgroundType',
  'backgroundRotation',
]);

const HIDDEN_KEYS = new Set(['randomizeIds', 'size']);

const FACE_KEY_PATTERN =
  /^(eyes|eyebrows|mouth|nose|facialHair|skin|face|cheek|freckles|blush|mustache|beard)/i;
const HAIR_KEY_PATTERN = /^(top|hair|hat|head|fringe|bangs)/i;
const OUTFIT_KEY_PATTERN =
  /^(clothing|clothes|accessories|graphic|shirt|jacket|coat|earrings|glasses|mask|neck|body)/i;

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/Probability$/, ' Probability')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

export function humanizeEnumValue(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

export function resolveFieldCategory(
  key: string,
  kind: DiceBearFieldKind,
  group: DiceBearFieldDefinition['group']
): DiceBearFieldCategory {
  if (kind === 'probability') return 'advanced';
  if (key === 'seed' || ['flip', 'rotate', 'scale', 'radius', 'translateX', 'translateY', 'clip'].includes(key)) {
    return 'advanced';
  }
  if (group === 'background' || key.startsWith('background')) return 'background';
  if (FACE_KEY_PATTERN.test(key)) return 'face';
  if (HAIR_KEY_PATTERN.test(key)) return 'hair';
  if (OUTFIT_KEY_PATTERN.test(key)) return 'outfit';
  if (group === 'style') return 'style';
  return 'advanced';
}

function isSchemaObject(
  schema: SchemaProperty | boolean | undefined
): schema is SchemaProperty {
  return typeof schema === 'object' && schema !== null && !Array.isArray(schema);
}

function resolveFieldKind(key: string, property: SchemaProperty): DiceBearFieldKind | null {
  if (key === 'seed') return 'seed';

  if (property.type === 'boolean') return 'boolean';

  if (property.type === 'integer') {
    if (key.endsWith('Probability')) return 'probability';
    return 'integer';
  }

  if (property.type === 'array' && isSchemaObject(property.items)) {
    if (property.items.enum?.length) return 'enum';
    if (property.items.pattern?.includes('a-fA-F0-9')) return 'colorMulti';
    if (property.items.type === 'integer') return 'integerMulti';
  }

  return null;
}

function parseProperties(
  properties: SchemaProperties | undefined,
  group: DiceBearFieldDefinition['group']
): DiceBearFieldDefinition[] {
  if (!properties) return [];

  const fields: DiceBearFieldDefinition[] = [];

  for (const [key, rawProperty] of Object.entries(properties)) {
    if (!isSchemaObject(rawProperty)) continue;
    if (HIDDEN_KEYS.has(key)) continue;

    const kind = resolveFieldKind(key, rawProperty);
    if (!kind) continue;

    fields.push({
      key,
      label: humanizeKey(key),
      kind,
      group,
      category: resolveFieldCategory(key, kind, group),
      enumValues: kind === 'enum' ? rawProperty.items?.enum?.map(String) : undefined,
      min: rawProperty.minimum,
      max: rawProperty.maximum,
      defaultValue: rawProperty.default,
    });
  }

  return fields;
}

export function getDiceBearFieldsForStyle(styleKey: DiceBearStyleKey): DiceBearFieldDefinition[] {
  const styleModule = getDiceBearStyleModule(styleKey);
  const coreProps = coreSchema.properties ?? {};
  const styleProps = styleModule.schema?.properties ?? {};

  const general = parseProperties(
    Object.fromEntries(
      Object.entries(coreProps).filter(([key]) => CORE_GENERAL_KEYS.has(key))
    ) as SchemaProperties,
    'general'
  );

  const background = parseProperties(
    Object.fromEntries(
      Object.entries(coreProps).filter(([key]) => CORE_BACKGROUND_KEYS.has(key))
    ) as SchemaProperties,
    'background'
  );

  const styleSpecific = parseProperties(
    Object.fromEntries(
      Object.entries(styleProps).filter(
        ([key]) => !CORE_GENERAL_KEYS.has(key) && !CORE_BACKGROUND_KEYS.has(key)
      )
    ) as SchemaProperties,
    'style'
  );

  return [...general, ...background, ...styleSpecific];
}

export function getFieldsByCategory(
  fields: DiceBearFieldDefinition[],
  category: DiceBearFieldCategory
): DiceBearFieldDefinition[] {
  return fields.filter((field) => field.category === category);
}

export const AVATAR_BUILDER_TABS: AvatarBuilderTab[] = [
  'style',
  'face',
  'hair',
  'outfit',
  'background',
  'advanced',
];

export function buildDiceBearOptions(
  fields: DiceBearFieldDefinition[],
  values: Record<string, unknown>
): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = values[field.key];

    if (raw === undefined || raw === null || raw === DICEBEAR_RANDOM || raw === '') {
      continue;
    }

    switch (field.kind) {
      case 'seed':
        options.seed = String(raw);
        break;
      case 'boolean':
        options[field.key] = Boolean(raw);
        break;
      case 'integer':
      case 'probability':
        options[field.key] = Number(raw);
        break;
      case 'enum':
        options[field.key] = [String(raw)];
        break;
      case 'colorMulti':
        options[field.key] = Array.isArray(raw)
          ? raw.map(String)
          : [String(raw).replace('#', '')];
        break;
      case 'integerMulti':
        options[field.key] = Array.isArray(raw) ? raw.map(Number) : [Number(raw)];
        break;
      default:
        break;
    }
  }

  return options;
}

export function extractFieldValuesFromOptions(
  fields: DiceBearFieldDefinition[],
  options: Record<string, unknown>
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = options[field.key];

    if (raw === undefined) {
      if (field.kind === 'enum' || field.kind === 'colorMulti' || field.kind === 'integerMulti') {
        values[field.key] = DICEBEAR_RANDOM;
      }
      continue;
    }

    switch (field.kind) {
      case 'enum':
      case 'colorMulti':
        values[field.key] = Array.isArray(raw) ? raw[0] ?? DICEBEAR_RANDOM : raw;
        break;
      case 'integerMulti':
        values[field.key] = Array.isArray(raw) ? raw : raw;
        break;
      default:
        values[field.key] = raw;
        break;
    }
  }

  return values;
}

export function getDefaultFieldValues(
  fields: DiceBearFieldDefinition[],
  seed: string
): Record<string, unknown> {
  const values: Record<string, unknown> = { seed };

  for (const field of fields) {
    if (field.key === 'seed') continue;

    if (field.kind === 'enum' || field.kind === 'colorMulti' || field.kind === 'integerMulti') {
      values[field.key] = DICEBEAR_RANDOM;
      continue;
    }

    if (field.defaultValue !== undefined) {
      values[field.key] = field.defaultValue;
    }
  }

  return values;
}
