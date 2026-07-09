'use client';

import { Input, Select, Switch, Text, Textarea, Badge, Button } from 'rizzui';
import { PiPlusBold, PiTrashBold } from 'react-icons/pi';
import type { FieldSchema } from '../schema-types';
import JsonSchemaForm from './json-schema-form';
import type { LlmModel, LogicalCatalogEntry } from '@/types/pipeline-admin.types';
import StatusDot from '../../components/status-dot';
import { modelHealthKind, statusDotColor } from '@/utils/model-health';
import { buildLogicalSelectOptions, resolveLogicalId } from '../../helpers/logical-model-options';

interface FieldRendererProps {
  field: FieldSchema;
  value: unknown;
  models?: LlmModel[];
  catalog?: LogicalCatalogEntry[];
  error?: string;
  onChange: (key: string, value: unknown) => void;
}

export default function FieldRenderer({
  field,
  value,
  models = [],
  catalog = [],
  error,
  onChange,
}: FieldRendererProps) {
  const strVal = value == null ? '' : String(value);

  if (field.type === 'toggle') {
    return (
      <Switch
        label={field.label}
        checked={Boolean(value)}
        disabled={field.readOnly}
        onChange={(e) => onChange(field.key, e.target.checked)}
      />
    );
  }

  if (field.type === 'model_select') {
    const logicalOptions = buildLogicalSelectOptions(models, catalog, { activeOnly: true });
    const options = [
      ...(field.key.includes('fallback') ? [{ label: '—', value: '' }] : []),
      ...logicalOptions.map((o) => ({ label: o.label, value: o.value })),
    ];
    const selected =
      models.find((m) => resolveLogicalId(m) === strVal) ??
      models.find((m) => m.name === strVal);
    const kind = selected ? modelHealthKind(selected) : 'unknown';
    return (
      <div>
        <Select
          size="sm"
          label={field.label}
          options={options}
          value={strVal || undefined}
          disabled={field.readOnly}
          onChange={(opt: { value: string } | null) => onChange(field.key, opt?.value ?? '')}
        />
        {selected && (
          <div className="mt-1 flex items-center gap-1">
            <StatusDot color={statusDotColor(kind)} pulse={kind === 'healthy'} size="sm" />
            <Text className="text-[10px] text-gray-500">{kind}</Text>
          </div>
        )}
        {error && <Text className="mt-1 text-xs text-red-500">{error}</Text>}
      </div>
    );
  }

  if (field.type === 'enum' || field.type === 'select') {
    return (
      <Select
        size="sm"
        label={field.label}
        options={field.options ?? []}
        value={strVal || undefined}
        disabled={field.readOnly}
        onChange={(opt: { value: string } | null) => onChange(field.key, opt?.value ?? '')}
      />
    );
  }

  if (field.type === 'json') {
    const obj =
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const isFlatObject =
      Object.values(obj).every(
        (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v)
      );
    if (isFlatObject && !field.readOnly) {
      return (
        <div className="space-y-2">
          <JsonSchemaForm
            label={field.label}
            value={obj}
            readOnly={field.readOnly}
            onChange={(next) => onChange(field.key, next)}
          />
          <Textarea
            size="sm"
            label={`${field.label} (raw JSON)`}
            value={JSON.stringify(obj, null, 2)}
            rows={3}
            className="font-mono text-xs"
            onChange={(e) => {
              try {
                onChange(field.key, JSON.parse(e.target.value));
              } catch {
                onChange(field.key, e.target.value);
              }
            }}
          />
        </div>
      );
    }
    const jsonStr =
      typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2);
    return (
      <Textarea
        size="sm"
        label={field.label}
        value={jsonStr}
        rows={4}
        disabled={field.readOnly}
        className="font-mono text-xs"
        onChange={(e) => {
          try {
            onChange(field.key, JSON.parse(e.target.value));
          } catch {
            onChange(field.key, e.target.value);
          }
        }}
      />
    );
  }

  if (field.type === 'readonly_computed') {
    return (
      <div>
        <Text className="text-[10px] text-gray-400">{field.label}</Text>
        <Badge variant="outline" size="sm" className="mt-0.5 font-mono text-[10px]">
          {strVal || '—'}
        </Badge>
      </div>
    );
  }

  if (field.type === 'slider') {
    const min = field.min ?? 0;
    const max = field.max ?? 100;
    const step = field.step ?? 1;
    const numVal = typeof value === 'number' ? value : Number(value) || min;
    return (
      <div>
        <Text className="mb-1 text-xs text-gray-600">{field.label}</Text>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={numVal}
            disabled={field.readOnly}
            className="h-2 flex-1 cursor-pointer accent-primary"
            onChange={(e) => onChange(field.key, Number(e.target.value))}
          />
          <Text className="w-10 text-right font-mono text-xs text-gray-500">{numVal}</Text>
        </div>
        {error && <Text className="mt-1 text-xs text-red-500">{error}</Text>}
      </div>
    );
  }

  if (field.type === 'color_picker') {
    const colorVal = strVal || '#6366f1';
    return (
      <div>
        <Text className="mb-1 text-xs text-gray-600">{field.label}</Text>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colorVal}
            disabled={field.readOnly}
            className="h-8 w-10 cursor-pointer rounded border border-muted bg-transparent p-0.5"
            onChange={(e) => onChange(field.key, e.target.value)}
          />
          <Input
            size="sm"
            value={colorVal}
            disabled={field.readOnly}
            className="flex-1 font-mono text-xs"
            onChange={(e) => onChange(field.key, e.target.value)}
          />
        </div>
        {error && <Text className="mt-1 text-xs text-red-500">{error}</Text>}
      </div>
    );
  }

  if (field.type === 'array') {
    const items = Array.isArray(value) ? value : [];
    const itemType = field.itemType ?? 'text';
    return (
      <div>
        <Text className="mb-1 text-xs text-gray-600">{field.label}</Text>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <Input
                size="sm"
                type={itemType === 'number' ? 'number' : 'text'}
                value={item == null ? '' : String(item)}
                disabled={field.readOnly}
                placeholder={field.placeholder}
                className="flex-1"
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = itemType === 'number' ? Number(e.target.value) : e.target.value;
                  onChange(field.key, next);
                }}
              />
              {!field.readOnly && (
                <Button
                  size="sm"
                  variant="text"
                  onClick={() => onChange(field.key, items.filter((_, i) => i !== idx))}
                >
                  <PiTrashBold className="h-3.5 w-3.5 text-red-500" />
                </Button>
              )}
            </div>
          ))}
          {!field.readOnly && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => onChange(field.key, [...items, itemType === 'number' ? 0 : ''])}
            >
              <PiPlusBold className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          )}
        </div>
        {error && <Text className="mt-1 text-xs text-red-500">{error}</Text>}
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <Input
        size="sm"
        type="number"
        label={field.label}
        value={strVal}
        disabled={field.readOnly}
        onChange={(e) => onChange(field.key, Number(e.target.value))}
      />
    );
  }

  return (
    <Input
      size="sm"
      label={field.label}
      value={strVal}
      disabled={field.readOnly}
      onChange={(e) => onChange(field.key, e.target.value)}
    />
  );
}
