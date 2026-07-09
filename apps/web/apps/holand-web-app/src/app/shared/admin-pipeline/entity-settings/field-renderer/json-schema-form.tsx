'use client';

import { useMemo } from 'react';
import { Input, Text, Button } from 'rizzui';
import { PiPlusBold, PiTrashBold } from 'react-icons/pi';

interface JsonSchemaFormProps {
  label: string;
  value: unknown;
  readOnly?: boolean;
  onChange: (value: Record<string, unknown>) => void;
}

function toObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function inferType(v: unknown): 'string' | 'number' | 'boolean' {
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'number') return 'number';
  return 'string';
}

export default function JsonSchemaForm({ label, value, readOnly, onChange }: JsonSchemaFormProps) {
  const obj = useMemo(() => toObject(value), [value]);
  const entries = Object.entries(obj);

  const patchKey = (key: string, next: unknown) => {
    onChange({ ...obj, [key]: next });
  };

  const removeKey = (key: string) => {
    const next = { ...obj };
    delete next[key];
    onChange(next);
  };

  const addKey = () => {
    let i = 1;
    let key = 'key';
    while (key in obj) {
      key = `key_${i++}`;
    }
    onChange({ ...obj, [key]: '' });
  };

  return (
    <div className="rounded-lg border border-muted p-2">
      <Text className="mb-2 text-xs font-medium text-gray-600">{label}</Text>
      <div className="space-y-2">
        {entries.map(([key, val]) => {
          const t = inferType(val);
          return (
            <div key={key} className="flex flex-wrap items-start gap-1">
              <Input
                size="sm"
                value={key}
                disabled={readOnly}
                className="min-w-[5rem] flex-1 font-mono text-[10px]"
                onChange={(e) => {
                  const newKey = e.target.value;
                  if (newKey === key) return;
                  const next = { ...obj };
                  delete next[key];
                  next[newKey] = val;
                  onChange(next);
                }}
              />
              {t === 'boolean' ? (
                <select
                  className="rounded border border-muted px-2 py-1 text-xs"
                  disabled={readOnly}
                  value={String(val)}
                  onChange={(e) => patchKey(key, e.target.value === 'true')}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <Input
                  size="sm"
                  type={t === 'number' ? 'number' : 'text'}
                  value={val == null ? '' : String(val)}
                  disabled={readOnly}
                  className="min-w-[6rem] flex-[2] font-mono text-[10px]"
                  onChange={(e) =>
                    patchKey(
                      key,
                      t === 'number' ? Number(e.target.value) : e.target.value
                    )
                  }
                />
              )}
              {!readOnly && (
                <Button size="sm" variant="text" onClick={() => removeKey(key)}>
                  <PiTrashBold className="size-3.5 text-red-500" />
                </Button>
              )}
            </div>
          );
        })}
        {!readOnly && (
          <Button size="sm" variant="outline" className="w-full" onClick={addKey}>
            <PiPlusBold className="mr-1 size-3.5" />
            Add field
          </Button>
        )}
        {entries.length === 0 && (
          <Text className="text-[10px] text-gray-400">No fields — add one or use raw JSON below.</Text>
        )}
      </div>
    </div>
  );
}
