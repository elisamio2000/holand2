import type { TopologyEntityKind, TopologyEdgeKind } from '../topology-board/helpers/topology-board-types';

export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'toggle'
  | 'json'
  | 'model_select'
  | 'enum'
  | 'readonly_computed'
  | 'array'
  | 'slider'
  | 'color_picker';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSchema {
  key: string;
  type: FieldType;
  label: string;
  labelKey?: string;
  required?: boolean;
  readOnly?: boolean;
  options?: FieldOption[];
  source?: 'api' | 'computed';
  visibleWhen?: Record<string, unknown>;
  min?: number;
  max?: number;
  step?: number;
  itemType?: 'text' | 'number';
  placeholder?: string;
}

export interface SettingsSectionSchema {
  id: string;
  label: string;
  labelKey?: string;
  defaultOpen?: boolean;
  fields: FieldSchema[];
}

export interface EntitySettingsSchema {
  kind: TopologyEntityKind | 'edge';
  primaryFields: string[];
  sections: SettingsSectionSchema[];
}

export type EdgeSettingsSchema = EntitySettingsSchema & { kind: 'edge' };

export const EDGE_KIND_OPTIONS: FieldOption[] = [
  { value: 'primary', label: 'next (primary)' },
  { value: 'loop', label: 'next·loop (fallback)' },
  { value: 'success', label: 'true / success' },
  { value: 'failure', label: 'false / failure' },
  { value: 'error_handler', label: 'error' },
];

export type SettingsPanelMode = 'compact' | 'advanced';
